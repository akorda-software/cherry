defmodule Snack.Dating.Safety do
  @moduledoc """
  Bloqueos y reportes con validación semántica para la API.

  Un bloqueo es idempotente y, al evaluarse en todas las lecturas sociales
  (discovery, likes, perfil público, matches, chat), oculta a la pareja en
  ambas direcciones y cierra la mensajería.
  """

  import Ecto.Query

  alias Snack.Accounts.User
  alias Snack.Dating.Match
  alias Snack.Dating.PairLock
  alias Snack.Dating.Profile
  alias Snack.Dating.Report
  alias Snack.Dating.UserBlock
  alias Snack.Repo

  @report_reasons ~w(fake_profile inappropriate_photos harassment spam underage offensive_bio other)
  @max_details_length 1000

  def report_reasons, do: @report_reasons
  def max_details_length, do: @max_details_length

  @doc """
  Bloquea `target_id`. Errores: `:profile_not_found` (inexistente o borrado),
  `:cannot_block_self`.
  """
  def block(%Profile{id: actor_id}, target_id) do
    with {:ok, target_id} <- existing_profile_id(target_id),
         :ok <- not_self(actor_id, target_id, :cannot_block_self) do
      if blocked?(actor_id, target_id) do
        {:ok, :already_blocked}
      else
        case block_profile(%{actor_profile_id: actor_id, target_profile_id: target_id}) do
          {:ok, block} ->
            {:ok, block}

          {:error, changeset} ->
            if unique_violation?(changeset),
              do: {:ok, :already_blocked},
              else: {:error, changeset}
        end
      end
    end
  end

  @doc """
  Reporta `target_id`. Errores: `:profile_not_found` (también si el perfil o su
  cuenta están borrados, sin distinguirlo de uno inexistente),
  `:cannot_report_self`, `:invalid_report_reason`, `:details_too_long`.

  Idempotente: si ya hay un reporte abierto del mismo reporter sobre el mismo
  perfil, lo devuelve sin crear otro (serializado por pareja).
  """
  def report(%Profile{id: reporter_id}, target_id, reason, details) do
    with {:ok, target_id} <- existing_profile_id(target_id),
         :ok <- not_self(reporter_id, target_id, :cannot_report_self),
         :ok <- validate_reason(reason),
         {:ok, details} <- normalize_details(details) do
      Repo.transaction(fn ->
        lock_report_pair(reporter_id, target_id)

        case open_report(reporter_id, target_id) do
          %Report{} = report ->
            report

          nil ->
            case report_profile(%{
                   reporter_profile_id: reporter_id,
                   target_profile_id: target_id,
                   reason: reason,
                   details: details
                 }) do
              {:ok, report} -> report
              {:error, changeset} -> Repo.rollback(changeset)
            end
        end
      end)
    end
  end

  defp open_report(reporter_id, target_id) do
    Repo.one(
      from(r in Report,
        where:
          r.reporter_profile_id == ^reporter_id and r.target_profile_id == ^target_id and
            r.status == "open",
        order_by: [asc: r.inserted_at],
        limit: 1
      )
    )
  end

  defp lock_report_pair(reporter_id, target_id) do
    <<key::signed-integer-size(64), _rest::binary>> =
      :crypto.hash(:sha256, "snack.report:" <> reporter_id <> ":" <> target_id)

    Repo.query!("SELECT pg_advisory_xact_lock($1)", [key])
  end

  # Live profiles only: a deleted profile or account answers exactly like an
  # unknown id.
  defp existing_profile_id(id) when is_binary(id) do
    with {:ok, id} <- Ecto.UUID.cast(id),
         true <-
           Repo.exists?(
             from(p in Profile,
               join: u in User,
               on: u.id == p.user_id,
               where: p.id == ^id and is_nil(p.deleted_at) and is_nil(u.deleted_at)
             )
           ) do
      {:ok, id}
    else
      _missing -> {:error, :profile_not_found}
    end
  end

  defp existing_profile_id(_id), do: {:error, :profile_not_found}

  defp not_self(id, id, error), do: {:error, error}
  defp not_self(_actor_id, _target_id, _error), do: :ok

  defp validate_reason(reason) when reason in @report_reasons, do: :ok
  defp validate_reason(_reason), do: {:error, :invalid_report_reason}

  defp normalize_details(nil), do: {:ok, nil}

  defp normalize_details(details) when is_binary(details) do
    details = String.trim(details)

    cond do
      details == "" -> {:ok, nil}
      String.length(details) > @max_details_length -> {:error, :details_too_long}
      true -> {:ok, details}
    end
  end

  defp normalize_details(_details), do: {:error, :details_too_long}

  defp blocked?(actor_id, target_id) do
    Repo.exists?(
      from(b in UserBlock,
        where: b.actor_profile_id == ^actor_id and b.target_profile_id == ^target_id
      )
    )
  end

  defp unique_violation?(%Ecto.Changeset{errors: errors}),
    do: Enum.any?(errors, fn {_field, {_msg, opts}} -> opts[:constraint] == :unique end)

  defp unique_violation?(_error), do: false

  # ── Safety ────────────────────────────────────────────────────────────

  @doc """
  Creates a block from one profile to another. Takes the same pair lock as
  `record_swipe/1`, so a like racing with the block either commits first (and
  the block then hides any match) or sees the block and fails.
  """
  def block_profile(attrs \\ %{}) do
    changeset = UserBlock.changeset(%UserBlock{}, attrs)

    if changeset.valid? do
      a = Ecto.Changeset.get_field(changeset, :actor_profile_id)
      b = Ecto.Changeset.get_field(changeset, :target_profile_id)

      Repo.transaction(fn ->
        with {:error, reason} <- PairLock.lock(Repo, a, b), do: Repo.rollback(reason)

        from(m in Match,
          where:
            (m.profile_a_id == ^a and m.profile_b_id == ^b) or
              (m.profile_a_id == ^b and m.profile_b_id == ^a),
          lock: "FOR UPDATE"
        )
        |> Repo.all()

        case Repo.insert(changeset) do
          {:ok, block} -> block
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    else
      {:error, changeset}
    end
  end

  @doc """
  Creates a report against a profile.
  """
  def report_profile(attrs \\ %{}) do
    %Report{}
    |> Report.changeset(attrs)
    |> Repo.insert()
  end

  # ── Admin ─────────────────────────────────────────────────────────────

  @doc """
  Lists reports filtered by status, paginated.

  `opts` may include `:limit` and `:offset`.
  """
  def list_reports(status, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    offset = Keyword.get(opts, :offset, 0)

    Report
    |> where([r], r.status == ^status)
    |> order_by([r], desc: r.inserted_at)
    |> limit(^limit)
    |> offset(^offset)
    |> Repo.all()
  end

  @doc """
  Updates a report (e.g., reviewing it).
  """
  def update_report(%Report{} = report, attrs) do
    report
    |> Report.changeset(attrs)
    |> Repo.update()
  end
end
