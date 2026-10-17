defmodule Cherry.PublicSite do
  @moduledoc "Public text catalogue; legal content lives independently of its HTML presentation."
  defdelegate version(), to: Cherry.Legal.Documents
  defdelegate documents(), to: Cherry.Legal.Documents, as: :all
  def document(slug), do: Enum.find(documents(), &(&1.slug == slug))
end
