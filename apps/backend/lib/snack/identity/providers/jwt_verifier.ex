defmodule Snack.Identity.Providers.JwtVerifier do
  @moduledoc false

  @default_leeway_seconds 30

  def verify(token, opts) when is_binary(token) and token != "" do
    with {:ok, jwt} <- decode(token),
         :ok <- validate_algorithm(jwt.header, opts),
         {:ok, public_key} <- resolve_public_key(jwt.header, opts),
         :ok <- verify_signature(jwt, public_key),
         :ok <- validate_issuer(jwt.claims, opts),
         :ok <- validate_audience(jwt.claims, opts),
         :ok <- validate_expiration(jwt.claims, opts),
         :ok <- validate_not_before(jwt.claims, opts),
         :ok <- validate_issued_at(jwt.claims, opts) do
      {:ok, %{header: jwt.header, claims: jwt.claims}}
    end
  end

  def verify(_token, _opts), do: {:error, :invalid_provider_token}

  defp decode(token) do
    case String.split(token, ".") do
      [encoded_header, encoded_claims, encoded_signature] ->
        with {:ok, header} <- decode_json_segment(encoded_header),
             {:ok, claims} <- decode_json_segment(encoded_claims),
             {:ok, signature} <- decode_binary_segment(encoded_signature) do
          {:ok,
           %{
             claims: claims,
             header: header,
             signature: signature,
             signing_input: encoded_header <> "." <> encoded_claims
           }}
        end

      _parts ->
        {:error, :invalid_provider_token}
    end
  end

  defp decode_json_segment(segment) do
    with {:ok, payload} <- decode_binary_segment(segment),
         {:ok, decoded} <- Jason.decode(payload) do
      {:ok, decoded}
    else
      _error -> {:error, :invalid_provider_token}
    end
  end

  defp decode_binary_segment(segment) do
    case Base.url_decode64(segment, padding: false) do
      {:ok, decoded} -> {:ok, decoded}
      :error -> {:error, :invalid_provider_token}
    end
  end

  defp validate_algorithm(header, opts) do
    allowed_algorithms = Keyword.get(opts, :allowed_algorithms, ["RS256"])

    if header["alg"] in allowed_algorithms do
      :ok
    else
      {:error, :invalid_provider_token}
    end
  end

  defp resolve_public_key(header, opts) do
    jwks = Keyword.get(opts, :jwks, [])
    kid = header["kid"]

    case Enum.filter(jwks, &matches_kid?(&1, kid)) do
      [jwk] -> jwk_to_public_key(jwk)
      [] -> {:error, :invalid_provider_token}
      _jwks -> {:error, :invalid_provider_token}
    end
  end

  defp matches_kid?(jwk, nil), do: length([jwk]) == 1
  defp matches_kid?(%{"kid" => jwk_kid}, kid), do: jwk_kid == kid
  defp matches_kid?(_jwk, _kid), do: false

  defp jwk_to_public_key(%{"kty" => "RSA", "n" => modulus, "e" => exponent}) do
    with {:ok, decoded_modulus} <- decode_unsigned(modulus),
         {:ok, decoded_exponent} <- decode_unsigned(exponent) do
      {:ok, {:RSAPublicKey, decoded_modulus, decoded_exponent}}
    end
  end

  defp jwk_to_public_key(_jwk), do: {:error, :invalid_provider_token}

  defp decode_unsigned(value) do
    with {:ok, decoded} <- decode_binary_segment(value) do
      {:ok, :binary.decode_unsigned(decoded)}
    end
  end

  defp verify_signature(jwt, public_key) do
    if :public_key.verify(jwt.signing_input, :sha256, jwt.signature, public_key) do
      :ok
    else
      {:error, :invalid_provider_token}
    end
  end

  defp validate_issuer(claims, opts) do
    allowed_issuers = Keyword.get(opts, :issuers, [])

    if is_binary(claims["iss"]) and claims["iss"] in allowed_issuers do
      :ok
    else
      {:error, :invalid_issuer}
    end
  end

  defp validate_audience(claims, opts) do
    allowed_audiences = Keyword.get(opts, :audiences, [])

    audiences =
      case claims["aud"] do
        audience when is_binary(audience) -> [audience]
        audience when is_list(audience) -> audience
        _audience -> []
      end

    if Enum.any?(audiences, &(&1 in allowed_audiences)) do
      :ok
    else
      {:error, :invalid_audience}
    end
  end

  defp validate_expiration(claims, opts) do
    case integer_claim(claims, "exp") do
      {:ok, exp} ->
        if exp >= now_unix() - leeway_seconds(opts) do
          :ok
        else
          {:error, :token_expired}
        end

      :error ->
        {:error, :invalid_provider_token}
    end
  end

  defp validate_not_before(claims, opts) do
    case claims["nbf"] do
      nil -> :ok
      _value -> validate_timestamp_not_after_now(claims, "nbf", :token_not_yet_valid, opts)
    end
  end

  defp validate_issued_at(claims, opts) do
    case claims["iat"] do
      nil -> :ok
      _value -> validate_timestamp_not_after_now(claims, "iat", :token_issued_in_future, opts)
    end
  end

  defp validate_timestamp_not_after_now(claims, claim_name, error_reason, opts) do
    case integer_claim(claims, claim_name) do
      {:ok, timestamp} ->
        if timestamp <= now_unix() + leeway_seconds(opts) do
          :ok
        else
          {:error, error_reason}
        end

      :error ->
        {:error, :invalid_provider_token}
    end
  end

  defp integer_claim(claims, claim_name) when is_binary(claim_name) do
    case claims[claim_name] do
      value when is_integer(value) -> {:ok, value}
      value when is_float(value) -> {:ok, trunc(value)}
      _value -> :error
    end
  end

  defp leeway_seconds(opts), do: Keyword.get(opts, :leeway_seconds, @default_leeway_seconds)
  defp now_unix, do: System.os_time(:second)
end
