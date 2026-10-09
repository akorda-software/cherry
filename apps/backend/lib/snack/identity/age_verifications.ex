defmodule Snack.Identity.AgeVerifications do
  @moduledoc """
  Age verification of users (D-2026-10-09, docs/compliance/02-mayoria-de-edad.md).

  `verify_nfc/3` receives DG1, DG2 and EF.SOD read from an identity document
  by the app, runs passive authentication, checks the holder is an adult and
  stores only "adult: yes", the method, the date and the keyed document
  fingerprint. The data groups never reach the database nor the logs and are
  dropped when the call returns.

  Making verification mandatory is prepared but off: the
  `:age_verification_required` feature flag (`AGE_VERIFICATION_REQUIRED`) is
  reported to the app and blocks the social API for unverified users through
  `SnackWeb.Plugs.RequireAgeVerification`.
  """

  import Ecto.Query

  require Logger

  alias Snack.Accounts.User
  alias Snack.Identity.{AgeVerification, AgeVerificationAttempt}
  alias Snack.Identity.Document.{Fingerprint, Mrz, PassiveAuth}
  alias Snack.Repo

  @type error ::
          :unavailable
          | {:too_many_attempts, retry_after_seconds :: pos_integer()}
          | PassiveAuth.error()
          | :underage
          | :document_already_used
          | :already_verified
          | :verification_revoked
          | :internal_error

  @default_attempt_limits [{5, 3600}, {10, 86_400}]

  @doc "Whether verification is mandatory to use the social features (off by default)."
  def required?, do: Snack.Features.enabled?(:age_verification_required)

  @doc "Whether NFC verification can run (a fingerprint key is configured)."
  def available?, do: Fingerprint.configured?()

  @doc "The user's verification, if any."
  @spec get(Ecto.UUID.t()) :: AgeVerification.t() | nil
  def get(user_id), do: Repo.get_by(AgeVerification, user_id: user_id)

  @doc "True when the user holds a valid verification."
  def verified?(user_id) do
    Repo.exists?(
      from(v in AgeVerification, where: v.user_id == ^user_id and v.status == "verified")
    )
  end

  @doc """
  Verifies an identity document read by NFC and records the user as an adult.

  Options: `:now` (`DateTime`), `:trust_anchors` (passed to `PassiveAuth`).
  """
  @spec verify_nfc(User.t(), %{dg1: binary(), dg2: binary(), sod: binary()}, keyword()) ::
          {:ok, AgeVerification.t()} | {:error, error()}
  def verify_nfc(%User{id: user_id}, %{dg1: _, dg2: _, sod: _} = document, opts \\ []) do
    now = Keyword.get_lazy(opts, :now, &DateTime.utc_now/0) |> DateTime.truncate(:second)

    result =
      with :ok <- check_available(),
           :ok <- register_attempt(user_id, now),
           {:ok, %{mrz: mrz} = auth} <- passive_auth(document, Keyword.put(opts, :now, now)),
           :ok <- check_adult(mrz, now),
           {:ok, fingerprint} <- Fingerprint.compute(mrz),
           {:ok, verification} <- store(user_id, method(mrz), fingerprint, now) do
        log_outcome(:ok, auth)
        {:ok, verification}
      end

    case result do
      {:ok, _} = ok ->
        ok

      {:error, {:too_many_attempts, _}} = error ->
        error

      {:error, reason} = error ->
        log_outcome(reason, nil)
        maybe_diagnose(reason, document)
        error
    end
  end

  @passive_auth_errors [
    :malformed_sod,
    :unsupported_algorithm,
    :missing_document_signer,
    :invalid_signature,
    :untrusted_certificate,
    :certificate_expired,
    :data_group_mismatch
  ]

  # Development only (`diagnostics: true` in config/dev.exs): public metadata
  # of the Document Signer certificate to understand a rejection of a real
  # document. Never DG1/DG2, hashes or document numbers (PassiveAuth.diagnose/1).
  defp maybe_diagnose(reason, %{sod: sod})
       when reason in @passive_auth_errors and is_binary(sod) do
    if Application.get_env(:snack, :age_verification, [])[:diagnostics] do
      Logger.warning(
        "age verification diagnostics (#{reason}): " <>
          inspect(PassiveAuth.diagnose(sod), limit: :infinity, printable_limit: 200) <>
          "\ntrusted CSCA: " <>
          inspect(
            Enum.map(
              Snack.Identity.Document.TrustStore.anchors(),
              &Snack.Identity.Document.Certificate.describe_name(&1.subject)
            )
          )
      )
    end
  rescue
    _ -> :ok
  end

  defp maybe_diagnose(_reason, _document), do: :ok

  defp check_available do
    if available?(), do: :ok, else: {:error, :unavailable}
  end

  # Serialised per user with a row lock, committed before the (slower)
  # verification so failed attempts count too. Also prunes old attempts.
  defp register_attempt(user_id, now) do
    limits = attempt_limits()
    longest = limits |> Enum.map(&elem(&1, 1)) |> Enum.max()

    Repo.transaction(fn ->
      Repo.one!(from(u in User, where: u.id == ^user_id, select: u.id, lock: "FOR UPDATE"))

      from(a in AgeVerificationAttempt,
        where: a.user_id == ^user_id and a.inserted_at <= ^DateTime.add(now, -longest, :second)
      )
      |> Repo.delete_all()

      times =
        Repo.all(
          from(a in AgeVerificationAttempt,
            where: a.user_id == ^user_id,
            select: a.inserted_at,
            order_by: [desc: a.inserted_at]
          )
        )

      case exceeded(limits, times, now) do
        nil ->
          Repo.insert!(%AgeVerificationAttempt{user_id: user_id, inserted_at: now})
          :ok

        retry_after ->
          Repo.rollback({:too_many_attempts, retry_after})
      end
    end)
    |> case do
      {:ok, :ok} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  # Seconds until the oldest attempt inside each exceeded window leaves it.
  defp exceeded(limits, times, now) do
    limits
    |> Enum.flat_map(fn {limit, window} ->
      in_window = Enum.filter(times, &(DateTime.diff(now, &1) < window))

      if length(in_window) >= limit do
        oldest = in_window |> Enum.take(limit) |> List.last()
        [max(window - DateTime.diff(now, oldest), 1)]
      else
        []
      end
    end)
    |> Enum.max(fn -> nil end)
  end

  defp attempt_limits do
    Application.get_env(:snack, :age_verification, [])
    |> Keyword.get(:attempt_limits, @default_attempt_limits)
  end

  # A bug must not leak the document through a crash report: exceptions are
  # caught here and logged without their message or arguments.
  defp passive_auth(document, opts) do
    PassiveAuth.verify(document, opts)
  rescue
    exception ->
      Logger.error(
        "age verification: passive authentication crashed with #{inspect(exception.__struct__)}\n" <>
          sanitized_stacktrace(__STACKTRACE__)
      )

      {:error, :internal_error}
  end

  defp sanitized_stacktrace(stacktrace) do
    stacktrace
    |> Enum.map(fn
      {module, function, args, location} when is_list(args) ->
        {module, function, length(args), location}

      entry ->
        entry
    end)
    |> Exception.format_stacktrace()
  end

  defp check_adult(%Mrz{birth_date: birth}, now) do
    if Mrz.age(birth, DateTime.to_date(now)) >= minimum_age(),
      do: :ok,
      else: {:error, :underage}
  end

  defp minimum_age do
    Application.get_env(:snack, :age_verification, []) |> Keyword.get(:minimum_age, 18)
  end

  defp method(%Mrz{format: :td1}), do: "nfc_dni"
  defp method(%Mrz{format: :td3}), do: "nfc_passport"

  defp store(user_id, method, fingerprint, now) do
    case get(user_id) do
      %AgeVerification{status: "verified", document_fingerprint: ^fingerprint} = existing ->
        {:ok, existing}

      %AgeVerification{status: "verified"} ->
        {:error, :already_verified}

      %AgeVerification{} ->
        {:error, :verification_revoked}

      nil ->
        %AgeVerification{}
        |> AgeVerification.changeset(%{
          user_id: user_id,
          status: "verified",
          method: method,
          verified_at: now,
          document_fingerprint: fingerprint
        })
        |> Repo.insert()
        |> case do
          {:ok, verification} ->
            {:ok, verification}

          {:error, %Ecto.Changeset{errors: errors}} ->
            cond do
              Keyword.has_key?(errors, :document_fingerprint) -> {:error, :document_already_used}
              Keyword.has_key?(errors, :user_id) -> {:error, :already_verified}
              true -> {:error, :internal_error}
            end
        end
    end
  end

  # Only the outcome and which CSCA anchored the chain (shared by every
  # document of a series). Never the user, so the log does not tell who is a
  # minor; never anything read from the document.
  defp log_outcome(:ok, %{csca: csca}) do
    Logger.info(
      "age verification: verified (CSCA #{binary_part(Snack.Identity.Document.Certificate.fingerprint(csca), 0, 16)})"
    )
  end

  defp log_outcome(:underage, _auth), do: Logger.info("age verification: not eligible")
  defp log_outcome(reason, _auth), do: Logger.info("age verification: rejected (#{reason})")
end
