defmodule Cherry.Backoffice.Access do
  @moduledoc "Explicit console provisioning; one-use login codes and revocable, separate staff sessions."
  import Ecto.Query
  alias Cherry.Backoffice.{Credential, Staff, Password, LoginThrottle}
  alias Cherry.Casework.Audit
  alias Cherry.Repo

  @login_seconds 600
  @session_seconds 28_800
  def session_seconds, do: @session_seconds

  # Console recovery/bootstrap. Web grants live in Team and require a superadmin.
  def provision(email, role) do
    Repo.transaction(fn ->
      normalized = String.downcase(String.trim(email))

      staff =
        Repo.one(from(s in Staff, where: s.email == ^normalized, lock: "FOR UPDATE")) || %Staff{}

      staff =
        case Repo.insert_or_update(
               Staff.changeset(staff, %{email: normalized, role: role, disabled_at: nil})
             ) do
          {:ok, staff} -> staff
          {:error, reason} -> Repo.rollback(reason)
        end

      from(c in Credential, where: c.staff_id == ^staff.id) |> Repo.delete_all()
      Audit.record!("staff_provisioned", %{staff_id: staff.id, metadata: %{role: role}})
      staff
    end)
  end

  def disable(email) do
    Repo.transaction(fn ->
      staff =
        Repo.one(from(s in Staff, where: s.email == ^normalize(email), lock: "FOR UPDATE")) ||
          Repo.rollback(:not_found)

      Repo.update!(Ecto.Changeset.change(staff, disabled_at: now()))
      from(c in Credential, where: c.staff_id == ^staff.id) |> Repo.delete_all()
      Audit.record!("staff_disabled", %{staff_id: staff.id})
      :ok
    end)
  end

  def issue_login(email) do
    Repo.transaction(fn ->
      staff =
        Repo.one(
          from(s in Staff,
            where: s.email == ^normalize(email) and is_nil(s.disabled_at),
            lock: "FOR UPDATE"
          )
        ) || Repo.rollback(:not_found)

      from(c in Credential, where: c.staff_id == ^staff.id and c.kind == "login")
      |> Repo.delete_all()

      from(c in Credential, where: c.staff_id == ^staff.id and c.expires_at <= ^now())
      |> Repo.delete_all()

      code = insert_credential!(staff.id, "login", @login_seconds)
      Audit.record!("login_issued", %{staff_id: staff.id})
      code
    end)
  end

  @doc "Writes the code to an exclusive 0600 file, never stdout or an application log."
  def issue_login_to_file(email, path) do
    with true <- Path.type(path) == :absolute,
         :ok <- private_directory(Path.dirname(path)),
         {:ok, file} <- File.open(path, [:write, :exclusive, :binary]) do
      try do
        :ok = File.chmod(path, 0o600)

        case issue_login(email) do
          {:ok, code} -> IO.binwrite(file, code <> "\n")
          error -> error
        end
      after
        File.close(file)
      end
    else
      false -> {:error, :absolute_path_required}
      error -> error
    end
  end

  def exchange(code) when is_binary(code) and byte_size(code) in 32..128 do
    Repo.transaction(fn ->
      # Lock order is always staff -> credential, also for disable/provision.
      digest = hash(String.trim(code))

      staff_id =
        Repo.one(
          from(c in Credential,
            where: c.token_hash == ^digest and c.kind == "login",
            select: c.staff_id
          )
        ) || Repo.rollback(:invalid_code)

      staff = authorize!(%Staff{id: staff_id}, :login)

      credential =
        Repo.one(
          from(c in Credential,
            where: c.token_hash == ^digest and c.kind == "login" and c.expires_at > ^now(),
            lock: "FOR UPDATE"
          )
        ) || Repo.rollback(:invalid_code)

      # The clock may have advanced while waiting for the row lock.
      if DateTime.compare(credential.expires_at, now()) != :gt, do: Repo.rollback(:invalid_code)
      Repo.delete!(credential)
      session = insert_credential!(staff.id, "session", @session_seconds)
      Audit.record!("staff_login", %{staff_id: staff.id})
      %{staff: staff, token: session}
    end)
  end

  def exchange(_), do: {:error, :invalid_code}

  def accept_invitation(code, password) do
    if is_binary(code) and byte_size(code) in 32..128 and Password.valid?(password) do
      Repo.transaction(fn ->
        digest = hash(String.trim(code))

        staff_id =
          Repo.one(
            from(c in Credential,
              where: c.token_hash == ^digest and c.kind == "invite",
              select: c.staff_id
            )
          ) || Repo.rollback(:invalid_code)

        staff =
          Repo.one(
            from(s in Staff,
              where: s.id == ^staff_id and is_nil(s.disabled_at),
              lock: "FOR UPDATE"
            )
          ) || Repo.rollback(:invalid_code)

        credential =
          Repo.one(
            from(c in Credential,
              where: c.token_hash == ^digest and c.kind == "invite",
              lock: "FOR UPDATE"
            )
          ) || Repo.rollback(:invalid_code)

        if DateTime.compare(credential.expires_at, now()) != :gt, do: Repo.rollback(:invalid_code)
        Repo.delete!(credential)

        staff =
          Repo.update!(
            Ecto.Changeset.change(staff,
              password_hash: Password.hash(password),
              password_change_required: false,
              failed_login_attempts: 0,
              login_blocked_until: nil
            ),
            log: false
          )

        Audit.record!("staff_invitation_accepted", %{staff_id: staff.id})
        %{staff: staff, token: insert_credential!(staff.id, "session", @session_seconds)}
      end)
    else
      {:error, :invalid_invitation}
    end
  end

  def password_login(email, password, ip) do
    if LoginThrottle.allow?(ip) do
      Repo.transaction(fn ->
        staff =
          if is_binary(email) and byte_size(email) <= 254,
            do:
              Repo.one(from(s in Staff, where: s.email == ^normalize(email), lock: "FOR UPDATE"))

        cond do
          is_nil(staff) or not is_nil(staff.disabled_at) ->
            Password.verify(password, nil)
            {:error, :invalid_credentials}

          staff.login_blocked_until && DateTime.compare(staff.login_blocked_until, now()) == :gt ->
            {:error, :invalid_credentials}

          Password.verify(password, staff.password_hash) ->
            staff =
              Repo.update!(
                Ecto.Changeset.change(staff, failed_login_attempts: 0, login_blocked_until: nil),
                log: false
              )

            Audit.record!("staff_login", %{staff_id: staff.id})

            {:ok,
             %{staff: staff, token: insert_credential!(staff.id, "session", @session_seconds)}}

          true ->
            count = if staff.login_blocked_until, do: 1, else: staff.failed_login_attempts + 1

            Repo.update!(
              Ecto.Changeset.change(staff,
                failed_login_attempts: count,
                login_blocked_until: if(count >= 5, do: DateTime.add(now(), 900))
              ),
              log: false
            )

            {:error, :invalid_credentials}
        end
      end)
      |> case do
        {:ok, result} -> result
        error -> error
      end
    else
      {:error, :rate_limited}
    end
  end

  def authenticate(token) when is_binary(token) and byte_size(token) in 32..128 do
    Repo.one(
      from(s in Staff,
        join: c in Credential,
        on: c.staff_id == s.id,
        where:
          c.token_hash == ^hash(token) and c.kind == "session" and c.expires_at > ^now() and
            is_nil(s.disabled_at),
        select: s
      )
    )
  end

  def authenticate(_), do: nil

  def logout(token) when is_binary(token) do
    Repo.transaction(fn ->
      # Keep the same staff -> credential lock order as disable/provision/exchange.
      staff_id =
        Repo.one(
          from(c in Credential,
            where: c.token_hash == ^hash(token) and c.kind == "session",
            select: c.staff_id
          )
        )

      if staff_id, do: Repo.one(from(s in Staff, where: s.id == ^staff_id, lock: "FOR SHARE"))

      case Repo.one(
             from(c in Credential,
               where: c.token_hash == ^hash(token) and c.kind == "session",
               lock: "FOR UPDATE"
             )
           ) do
        nil ->
          :ok

        credential ->
          Repo.delete!(credential)
          Audit.record!("staff_logout", %{staff_id: credential.staff_id})
      end

      :ok
    end)
  end

  def logout(_), do: {:ok, :ok}

  def authorize!(%Staff{id: id}, permission) do
    staff =
      Repo.one(from(s in Staff, where: s.id == ^id and is_nil(s.disabled_at), lock: "FOR SHARE")) ||
        Repo.rollback(:forbidden)

    if allowed?(staff, permission), do: staff, else: Repo.rollback(:forbidden)
  end

  def authorize!(_, _), do: Repo.rollback(:forbidden)

  def allowed?(%Staff{role: "superadmin"}, permission)
      when permission in [:login, :queue, :reassign, :manage_team] or
             permission in ~w(report complaint privacy appeal measure),
      do: true

  def allowed?(%Staff{}, :manage_team), do: false

  def allowed?(%Staff{role: "admin"}, permission)
      when permission in [:login, :queue, :reassign] or
             permission in ~w(report complaint privacy appeal measure),
      do: true

  def allowed?(%Staff{}, :login), do: true
  def allowed?(%Staff{}, :queue), do: true
  def allowed?(%Staff{role: "privacy"}, "privacy"), do: true

  def allowed?(%Staff{role: "moderator"}, kind) when kind in ~w(report complaint appeal measure),
    do: true

  def allowed?(_, _), do: false

  def prune_expired do
    from(c in Credential, where: c.expires_at <= ^now()) |> Repo.delete_all()
  end

  defp insert_credential!(staff_id, kind, ttl) do
    token = :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)

    Repo.insert!(%Credential{
      staff_id: staff_id,
      kind: kind,
      token_hash: hash(token),
      expires_at: DateTime.add(now(), ttl)
    })

    token
  end

  defp hash(token), do: :crypto.hash(:sha256, token)

  defp private_directory(path) do
    case File.stat(path) do
      {:ok, %{type: :directory, mode: mode}} ->
        if Bitwise.band(mode, 0o777) == 0o700,
          do: :ok,
          else: {:error, :private_directory_required}

      _ ->
        {:error, :private_directory_required}
    end
  end

  defp normalize(email), do: email |> String.trim() |> String.downcase()
  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
