defmodule Snack.Repo.Migrations.AddDislikesReceivedIndex do
  @moduledoc """
  Discovery excludes candidates who already disliked the viewer (D-2026-09-29).

  Partial index over dislikes only: the feed reads the dislikes a viewer has
  received as an index-only scan (no heap fetches, cost proportional to those
  dislikes, not to every swipe received), and `(target, actor)` also serves a
  per-candidate probe if the planner prefers a nested loop.
  """
  use Ecto.Migration

  def change do
    create(
      index(:swipe_actions, [:target_profile_id, :actor_profile_id],
        where: "action_type = 'dislike'",
        name: :swipe_actions_dislikes_received_index
      )
    )
  end
end
