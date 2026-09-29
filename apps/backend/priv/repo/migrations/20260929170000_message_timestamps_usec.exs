defmodule Snack.Repo.Migrations.MessageTimestampsUsec do
  @moduledoc """
  Mensajes y marcas de lectura con precisión de microsegundos: con precisión de
  segundo, dos mensajes enviados en el mismo segundo («hola» + «¿qué tal?»)
  podían salir desordenados al recargar, y un mensaje llegado en el mismo segundo
  en que se abría el chat contaba como leído.
  """
  use Ecto.Migration

  def change do
    alter table(:messages) do
      modify(:inserted_at, :utc_datetime_usec, from: :utc_datetime)
      modify(:updated_at, :utc_datetime_usec, from: :utc_datetime)
    end

    alter table(:conversation_reads) do
      modify(:last_read_at, :utc_datetime_usec, from: :utc_datetime)
    end
  end
end
