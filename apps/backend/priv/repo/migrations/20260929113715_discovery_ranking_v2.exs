defmodule Cherry.Repo.Migrations.DiscoveryRankingV2 do
  @moduledoc """
  Discovery ranking v2 (D-2026-09-29).

  * `profiles.completed_at` / `profiles.last_active_at`: newcomer boost and real
    activity signal (replaces the `updated_at` proxy).
  * `discovery_preferences.expand_distance`: second distance tier when supply is low.
  * Normalises stored preferences to the rules now enforced by the changeset
    (closed distance options and `age_min <= age_max`).
  * Partial index for likes received (reciprocity, attention fairness and the
    likes inbox).
  * `discovery_tag_weights`: versioned IDF weight cache refreshed periodically by
    `Cherry.Dating.Discovery.TagWeights`; a feed cursor pins one generation.
  """
  use Ecto.Migration

  def up do
    alter table(:profiles) do
      add(:completed_at, :utc_datetime)
      add(:last_active_at, :utc_datetime)
    end

    alter table(:discovery_preferences) do
      add(:expand_distance, :boolean, null: false, default: true)
    end

    # Existing complete profiles: the best available completion time is the last
    # write (they completed at or before it).
    execute(
      "UPDATE profiles SET completed_at = updated_at WHERE is_complete AND completed_at IS NULL"
    )

    # Activity backfill: latest of the last profile write and the last device login.
    execute("""
    UPDATE profiles p
    SET last_active_at = GREATEST(
      p.updated_at,
      (SELECT max(d.last_seen_at) FROM devices d WHERE d.user_id = p.user_id)
    )
    WHERE p.last_active_at IS NULL
    """)

    # The PUT endpoint used to accept any positive distance: round up to the next
    # allowed option so nobody's pool shrinks.
    execute("""
    UPDATE discovery_preferences
    SET distance_km = CASE
      WHEN distance_km <= 10 THEN 10
      WHEN distance_km <= 25 THEN 25
      WHEN distance_km <= 50 THEN 50
      WHEN distance_km <= 100 THEN 100
      ELSE 999999
    END
    WHERE distance_km NOT IN (10, 25, 50, 100, 999999)
    """)

    execute("""
    UPDATE discovery_preferences
    SET age_min = age_max, age_max = age_min
    WHERE age_min > age_max
    """)

    # Covering: the fairness penalty reads the liker without touching the heap.
    create(
      index(:swipe_actions, [:target_profile_id, :inserted_at],
        where: "action_type = 'like'",
        include: [:actor_profile_id],
        name: :swipe_actions_likes_received_index
      )
    )

    execute("CREATE SEQUENCE discovery_tag_weights_generation_seq")

    create table(:discovery_tag_weights, primary_key: false) do
      add(:generation, :bigint, null: false, primary_key: true)

      add(:tag_id, references(:tags, type: :binary_id, on_delete: :delete_all),
        null: false,
        primary_key: true
      )

      add(:profile_count, :integer, null: false)
      add(:total_profiles, :integer, null: false)
      add(:weight, :float, null: false)
      add(:computed_at, :utc_datetime, null: false)
    end

    create(index(:discovery_tag_weights, [:computed_at]))
  end

  def down do
    drop(table(:discovery_tag_weights))
    execute("DROP SEQUENCE discovery_tag_weights_generation_seq")

    drop(
      index(:swipe_actions, [:target_profile_id, :inserted_at],
        name: :swipe_actions_likes_received_index
      )
    )

    alter table(:discovery_preferences) do
      remove(:expand_distance)
    end

    alter table(:profiles) do
      remove(:last_active_at)
      remove(:completed_at)
    end
  end
end
