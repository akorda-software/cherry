defmodule Snack.Crypto.Encrypted do
  @moduledoc """
  Tipo Ecto que cifra al persistir y descifra al leer vía `Snack.Crypto`.

  El valor en memoria es siempre texto en claro; solo el almacenamiento está
  cifrado. Ver `Snack.Crypto` para formato y gestión de clave.
  """

  use Ecto.Type

  def type, do: :string

  def cast(value), do: Ecto.Type.cast(:string, value)

  def dump(value), do: Snack.Crypto.encrypt(value)

  def load(value), do: Snack.Crypto.decrypt(value)
end
