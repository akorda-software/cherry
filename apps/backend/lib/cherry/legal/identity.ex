defmodule Cherry.Legal.Identity do
  @moduledoc "Public operator details, separate from authentication and legal approval."

  def info do
    instance = Cherry.Instance.info()
    config = Application.get_env(:cherry, :public_legal, [])

    %{
      name: instance.operator,
      email: instance.contact_email,
      address: Keyword.get(config, :address),
      tax_id: Keyword.get(config, :tax_id),
      registry: Keyword.get(config, :registry),
      approved: Keyword.get(config, :approved, false)
    }
  end

  def complete? do
    identity = info()
    Enum.all?([:name, :email, :address, :tax_id, :registry], &present?(identity[&1]))
  end

  def value(key), do: info()[key] || "[PENDIENTE: #{label(key)}]"

  defp present?(value),
    do:
      is_binary(value) and String.trim(value) != "" and not String.contains?(value, "[PENDIENTE")

  defp label(:name), do: "nombre del titular"
  defp label(:email), do: "correo de atención"
  defp label(:address), do: "domicilio del titular"
  defp label(:tax_id), do: "NIF del titular"
end
