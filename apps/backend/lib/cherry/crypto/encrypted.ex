defmodule Cherry.Crypto.Encrypted do
  @moduledoc """
  Tipo Ecto que cifra al persistir y descifra al leer vía `Cherry.Crypto`.

  El valor en memoria es siempre texto en claro; solo el almacenamiento está
  cifrado. Ver `Cherry.Crypto` para formato y gestión de clave.
  """

  use Ecto.Type

  def type, do: :string

  def cast(value), do: Ecto.Type.cast(:string, value)

  def dump(value), do: Cherry.Crypto.encrypt(value)

  def load(value), do: Cherry.Crypto.decrypt(value)
end
