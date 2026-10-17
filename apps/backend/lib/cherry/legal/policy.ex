defmodule Cherry.Legal.Policy do
  @moduledoc "The exact publication and independent declarations shown before sensitive processing."
  alias Cherry.Legal.{Documents, Identity}

  def enforcement_enabled?, do: Application.get_env(:cherry, :legal_enforcement_enabled, false)

  def requirements do
    if enforcement_enabled?(), do: {true, ready?(), fingerprint()}, else: {false, false, ""}
  end

  def ready?,
    do:
      Identity.complete?() and Identity.info().approved and Cherry.Instance.info().country == "ES"

  def snapshot do
    %{
      version: Documents.version(),
      locale: "es-ES",
      operator: Map.drop(Identity.info(), [:approved]),
      termsText: "Acepto las condiciones de uso y las normas de comunidad de esta instancia.",
      adulthoodText:
        "Confirmo que tengo al menos 18 años. Esta declaración no sustituye la verificación de edad.",
      sensitiveText:
        "Consiento explícitamente que esta instancia trate mis preferencias de citas y los datos de mi perfil que puedan revelar mi vida u orientación sexual para seleccionar perfiles compatibles y mostrar mi perfil a las personas autorizadas según mis ajustes. No autorizo publicidad, venta de datos ni entrenamiento de IA. Puedo retirar este consentimiento en Ajustes mediante retirar y borrar la cuenta, o contactar sin sesión; no podré continuar el servicio de citas sin ese tratamiento. La retirada no afecta al tratamiento anterior.",
      documents:
        Enum.map(Documents.all(), fn document ->
          %{
            document
            | sections: Enum.map(document.sections, fn {heading, text} -> [heading, text] end)
          }
        end)
    }
  end

  def fingerprint(snapshot \\ snapshot()) do
    snapshot
    |> canonical()
    |> Jason.encode!()
    |> then(&:crypto.hash(:sha256, &1))
    |> Base.encode16(case: :lower)
  end

  def publication do
    snapshot = snapshot()
    Map.merge(snapshot, %{fingerprint: fingerprint(snapshot), ready: ready?()})
  end

  # Sort explicitly: hashes must not depend on JSON/map enumeration order.
  defp canonical(map) when is_map(map),
    do: map |> Enum.map(fn {k, v} -> [to_string(k), canonical(v)] end) |> Enum.sort()

  defp canonical(list) when is_list(list), do: Enum.map(list, &canonical/1)
  defp canonical(value), do: value
end
