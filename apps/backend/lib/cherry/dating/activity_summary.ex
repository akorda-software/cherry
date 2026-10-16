defmodule Cherry.Dating.ActivitySummary do
  @moduledoc "Badge aggregates in one statement and one database snapshot, without inbox hydration."

  import Ecto.Query

  alias Cherry.Dating.{Inbox, Profile}
  alias Cherry.Dating.Social.ReceivedLikes
  alias Cherry.Repo

  def get(%Profile{} = viewer) do
    from(inbox in subquery(Inbox.counts_query(viewer.id)),
      cross_join: likes in subquery(ReceivedLikes.count_query(viewer)),
      select: %{
        received_likes_count: likes.received_likes_count,
        new_matches_count: inbox.new_matches_count,
        unread_conversations_count: inbox.unread_conversations_count
      }
    )
    |> Repo.one()
  end
end
