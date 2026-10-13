defmodule Cherry.Identity.AgeVerifications do
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
  `CherryWeb.Plugs.RequireAgeVerification`. While it is on, an unverified
  profile is "pending verification": it can be edited but is not discoverable
  (`allows_discovery?/1`, used by `Cherry.Dating.Profiles`), and a successful
  verification makes it discoverable again unless the user paused it.

  `start_provider/3` and `check_provider/3` are the second method: a selfie
  and a photo of the document in Didit's hosted flow (`Cherry.Identity.Didit`).
  The app opens the session's URL and then asks for the decision; the outcome
  is stored exactly as with NFC (method `provider`) and the fingerprint is the
  same one NFC computes for that document, so one document is one account
  whatever the method. Didit's session is erased after a final decision.

  A minor's document is answered with `{:error, :underage}`; the caller erases
  the whole account (`Cherry.Accounts.purge_account/1`).
  """

  import Ecto.Query

  require Logger

  alias Cherry.Accounts.User
  alias Cherry.Dating.Profile
  alias Cherry.Identity.{AgeVerification, AgeVerificationAttempt, Didit}
  alias Cherry.Identity.Document.{Fingerprint, Mrz, PassiveAuth}
  alias Cherry.Repo

  @type error ::
          :unavailable
          | {:too_many_attempts, retry_after_seconds :: pos_integer()}
          | PassiveAuth.error()
          | :underage
          | :document_expired
          | :document_already_used
          | :already_verified
          | :verification_revoked
          | :internal_error

  @type provider_error ::
          :unavailable
          | {:too_many_attempts, retry_after_seconds :: pos_integer()}
          | :already_verified
          | :verification_revoked
          | :session_not_found
          | :session_expired
          | :verification_declined
          | :unsupported_document
          | :underage
          | :document_expired
          | :document_already_used
          | :provider_error
          | :internal_error

  @default_attempt_limits [{5, 3600}, {10, 86_400}]

  @doc "Whether verification is mandatory to use the social features (off by default)."
  def required?, do: Cherry.Features.enabled?(:age_verification_required)

  @doc "Whether NFC verification can run (a fingerprint key is configured)."
  def available?, do: Fingerprint.configured?()

  @doc "Whether verification through the external provider (Didit) can run."
  def provider_available?, do: Fingerprint.configured?() and Didit.configured?()

  @doc "The user's verification, if any."
  @spec get(Ecto.UUID.t()) :: AgeVerification.t() | nil
  def get(user_id), do: Repo.get_by(AgeVerification, user_id: user_id)

  @doc "True when the user holds a valid verification."
  def verified?(user_id) do
    Repo.exists?(
      from(v in AgeVerification, where: v.user_id == ^user_id and v.status == "verified")
    )
  end

  @doc "`\"unverified\"` (no verification), `\"verified\"` or `\"revoked\"`."
  @spec status(Ecto.UUID.t()) :: String.t()
  def status(user_id) do
    case get(user_id) do
      %AgeVerification{status: status} -> status
      nil -> "unverified"
    end
  end

  @doc """
  Whether the user's profile may be shown to others: verification is not
  mandatory or the user holds a valid one. Only the age verification part of
  `is_discoverable`; completeness and pause are checked by `Cherry.Dating.Profiles`.
  """
  @spec allows_discovery?(Ecto.UUID.t()) :: boolean()
  def allows_discovery?(user_id), do: not required?() or verified?(user_id)

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
           :ok <- check_in_force(mrz, now),
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

  @doc """
  Starts a verification with the external provider: a Didit session the app
  opens in a browser. `callback` is the URL Didit sends the user back to.
  Counts as an attempt (same limits as NFC); asking for the decision does not.
  """
  @spec start_provider(User.t(), String.t() | nil, keyword()) ::
          {:ok, %{session_id: String.t(), url: String.t()}} | {:error, provider_error()}
  def start_provider(%User{id: user_id}, callback, opts \\ []) do
    now = Keyword.get_lazy(opts, :now, &DateTime.utc_now/0) |> DateTime.truncate(:second)

    with :ok <- check_provider_available(),
         :ok <- check_unverified(user_id),
         :ok <- register_attempt(user_id, now) do
      Didit.create_session(user_id, callback)
    end
  end

  @doc """
  Reads the decision of a provider session started by `start_provider/3` and,
  when approved, records the user as an adult (method `provider`).

  `{:pending, :in_progress}` while the user has not finished, `{:pending,
  :in_review}` while Didit reviews it manually. A session of another user is
  `:session_not_found`. Option: `:now` (`DateTime`).
  """
  @spec check_provider(User.t(), String.t(), keyword()) ::
          {:ok, AgeVerification.t()}
          | {:pending, :in_progress | :in_review}
          | {:error, provider_error()}
  def check_provider(%User{id: user_id}, session_id, opts \\ []) do
    now = Keyword.get_lazy(opts, :now, &DateTime.utc_now/0) |> DateTime.truncate(:second)

    with :ok <- check_provider_available(),
         {:ok, session_id} <- cast_session_id(session_id),
         {:ok, decision} <- fetch_decision(session_id),
         :ok <- check_owner(decision, user_id) do
      decide(decision, user_id, session_id, now)
    end
    |> tap(&log_provider_outcome/1)
  end

  defp check_provider_available do
    if provider_available?(), do: :ok, else: {:error, :unavailable}
  end

  defp check_unverified(user_id) do
    case get(user_id) do
      nil -> :ok
      %AgeVerification{status: "verified"} -> {:error, :already_verified}
      %AgeVerification{} -> {:error, :verification_revoked}
    end
  end

  defp cast_session_id(session_id) do
    case Ecto.UUID.cast(session_id) do
      {:ok, uuid} -> {:ok, uuid}
      :error -> {:error, :session_not_found}
    end
  end

  defp fetch_decision(session_id) do
    case Didit.get_decision(session_id) do
      {:ok, decision} -> {:ok, decision}
      {:error, :not_found} -> {:error, :session_not_found}
      {:error, _} -> {:error, :provider_error}
    end
  end

  # vendor_data is the user id set when the session was created: nobody can
  # claim the session (the document) of another user.
  defp check_owner(%{vendor_data: user_id}, user_id), do: :ok
  defp check_owner(_decision, _user_id), do: {:error, :session_not_found}

  @in_progress ["not started", "in progress", "awaiting user", "resubmitted"]
  @ended ["expired", "kyc expired", "abandoned"]

  defp decide(%{status: status} = decision, user_id, session_id, now) do
    case status && String.downcase(status) do
      status when status in @in_progress ->
        {:pending, :in_progress}

      "in review" ->
        {:pending, :in_review}

      status when status in @ended ->
        erase_session(session_id)
        {:error, :session_expired}

      "declined" ->
        erase_session(session_id)

        if declined_minor?(decision, now),
          do: {:error, :underage},
          else: {:error, :verification_declined}

      "approved" ->
        result = approved(decision, user_id, now)
        erase_session(session_id)
        result

      _unknown ->
        Logger.warning("age verification (provider): unexpected session status")
        {:error, :provider_error}
    end
  end

  # A declined session may still have read a birth date: a minor is treated
  # as with any other method.
  defp declined_minor?(%{id_verifications: idvs}, now) do
    Enum.any?(idvs, fn idv ->
      case parse_date(idv.date_of_birth) do
        {:ok, birth} -> not adult?(birth, now)
        :error -> false
      end
    end)
  end

  defp approved(%{environment: environment, id_verifications: idvs}, user_id, now) do
    with :ok <- check_environment(environment),
         [idv | _] <- idvs,
         {:ok, code_letter} <- document_kind(idv.document_type),
         {:ok, birth} <- parse_date(idv.date_of_birth) |> or_declined(),
         :ok <- if(adult?(birth, now), do: :ok, else: {:error, :underage}),
         :ok <- check_provider_in_force(idv.expiration_date, now),
         {:ok, fingerprint} <- provider_fingerprint(idv, code_letter) do
      store(user_id, "provider", fingerprint, now)
    else
      [] -> {:error, :verification_declined}
      {:error, _} = error -> error
    end
  end

  # Sandbox decisions are made up by whoever runs the flow: only accepted
  # where configured (dev and test).
  defp check_environment("live"), do: :ok

  defp check_environment(_sandbox) do
    if Application.get_env(:cherry, :didit, [])[:allow_sandbox] do
      :ok
    else
      Logger.warning("age verification (provider): sandbox decision refused")
      {:error, :provider_error}
    end
  end

  # Code letter of the MRZ for each accepted kind of document (see
  # `Fingerprint`). A driving licence does not prove identity for this.
  defp document_kind(type) do
    case type && String.downcase(type) do
      "identity card" -> {:ok, "I"}
      "residence permit" -> {:ok, "I"}
      "passport" -> {:ok, "P"}
      _other -> {:error, :unsupported_document}
    end
  end

  defp or_declined({:ok, _} = ok), do: ok
  defp or_declined(:error), do: {:error, :verification_declined}

  defp parse_date(value) when is_binary(value) do
    case Date.from_iso8601(value) do
      {:ok, date} -> {:ok, date}
      {:error, _} -> :error
    end
  end

  defp parse_date(_value), do: :error

  # Same rule as NFC: expired documents are refused, no expiry date is fine.
  defp check_provider_in_force(nil, _now), do: :ok

  defp check_provider_in_force(expiration, now) do
    case parse_date(expiration) do
      {:ok, expiry} ->
        if Date.compare(expiry, DateTime.to_date(now)) == :lt,
          do: {:error, :document_expired},
          else: :ok

      :error ->
        {:error, :verification_declined}
    end
  end

  # The same input NFC builds from the MRZ: the DNI/NIE for Spanish identity
  # cards and residence permits (whichever of the two numbers holds it), else
  # issuing state, kind and document number.
  defp provider_fingerprint(idv, code_letter) do
    state = idv.issuing_state |> normalize() |> icao_state()
    number = normalize(idv.document_number)

    spanish_id =
      if state == "ESP" and code_letter == "I" do
        Enum.find([normalize(idv.personal_number), number], &Mrz.valid_spanish_id?/1)
      end

    cond do
      spanish_id != nil ->
        Fingerprint.compute_fields("ESP", "I", "", spanish_id)

      state == "" or number == "" ->
        {:error, :verification_declined}

      true ->
        Fingerprint.compute_fields(state, code_letter, number, nil)
    end
    |> case do
      {:ok, fingerprint} -> {:ok, fingerprint}
      {:error, :not_configured} -> {:error, :unavailable}
      {:error, _} = error -> error
    end
  end

  defp normalize(nil), do: ""
  defp normalize(value), do: value |> String.upcase() |> String.replace(~r/[^A-Z0-9]/, "")

  # ICAO 9303 writes Germany as "D", not its ISO alpha-3 code.
  defp icao_state("DEU"), do: "D"
  defp icao_state(state), do: state

  # After a final decision Didit must not keep the photos, the selfie nor the
  # data it read. A failure does not undo the user's verification.
  defp erase_session(session_id) do
    case Didit.delete_session(session_id) do
      :ok ->
        :ok

      {:error, status} ->
        Logger.warning("age verification (provider): session erasure failed (#{status})")
        :error
    end
  end

  defp log_provider_outcome({:ok, _}),
    do: Logger.info("age verification (provider): verified")

  defp log_provider_outcome({:pending, _}), do: :ok

  defp log_provider_outcome({:error, :underage}),
    do: Logger.info("age verification (provider): not eligible")

  defp log_provider_outcome({:error, reason}),
    do: Logger.info("age verification (provider): rejected (#{reason})")

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
    if Application.get_env(:cherry, :age_verification, [])[:diagnostics] do
      Logger.warning(
        "age verification diagnostics (#{reason}): " <>
          inspect(PassiveAuth.diagnose(sod), limit: :infinity, printable_limit: 200) <>
          "\ntrusted CSCA: " <>
          inspect(
            Enum.map(
              Cherry.Identity.Document.TrustStore.anchors(),
              &Cherry.Identity.Document.Certificate.describe_name(&1.subject)
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
    Application.get_env(:cherry, :age_verification, [])
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

  # Expired documents are refused: otherwise every old passport would be a new
  # fingerprint (one more account). A document without a readable expiry date
  # (e.g. without expiry) is accepted.
  defp check_in_force(%Mrz{expiry_date: %Date{} = expiry}, now) do
    if Date.compare(expiry, DateTime.to_date(now)) == :lt,
      do: {:error, :document_expired},
      else: :ok
  end

  defp check_in_force(%Mrz{}, _now), do: :ok

  defp check_adult(%Mrz{birth_date: birth}, now) do
    if adult?(birth, now), do: :ok, else: {:error, :underage}
  end

  defp adult?(birth, now), do: Mrz.age(birth, DateTime.to_date(now)) >= minimum_age()

  defp minimum_age do
    Application.get_env(:cherry, :age_verification, []) |> Keyword.get(:minimum_age, 18)
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
            refresh_discoverable(user_id, now)
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

  # A profile left pending verification becomes discoverable again when it is
  # complete, not paused by its owner and not deleted. Only the schema is used
  # (no call into Cherry.Dating) so the contexts do not call each other back.
  defp refresh_discoverable(user_id, now) do
    from(p in Profile,
      where: p.user_id == ^user_id,
      update: [
        set: [
          is_discoverable: p.is_complete and not p.is_paused and is_nil(p.deleted_at),
          updated_at: ^now
        ]
      ]
    )
    |> Repo.update_all([])
  end

  # Only the outcome and which CSCA anchored the chain (shared by every
  # document of a series). Never the user, so the log does not tell who is a
  # minor; never anything read from the document.
  defp log_outcome(:ok, %{csca: csca}) do
    Logger.info(
      "age verification: verified (CSCA #{binary_part(Cherry.Identity.Document.Certificate.fingerprint(csca), 0, 16)})"
    )
  end

  defp log_outcome(:underage, _auth), do: Logger.info("age verification: not eligible")
  defp log_outcome(reason, _auth), do: Logger.info("age verification: rejected (#{reason})")
end
