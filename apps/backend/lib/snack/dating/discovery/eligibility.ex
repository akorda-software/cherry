defmodule Snack.Dating.Discovery.Eligibility do
  @moduledoc "Hard discovery filters. Every page reevaluates privacy and reciprocal preferences."

  def cte(ph, opts, geo_filter, tier_sql) do
    """
    candidates AS MATERIALIZED (
      SELECT p.id,
             p.looking_for AS intents,
             p.completed_at,
             p.last_active_at,
             dp.compatible_only,
             ST_Distance(pl.coordinates, #{ph.(:point)}::geography) AS distance_m,
             #{tier_sql} AS tier
      FROM profile_locations pl
      JOIN profiles p ON p.id = pl.profile_id
      JOIN users u ON u.id = p.user_id
      JOIN discovery_preferences dp ON dp.profile_id = p.id
      WHERE #{geo_filter}
        AND p.id <> #{ph.(:viewer)}::uuid
        AND p.is_discoverable AND p.is_complete AND NOT p.is_paused
        AND p.deleted_at IS NULL AND u.deleted_at IS NULL
        AND p.gender = ANY(#{ph.(:genders)}::text[])
        AND #{opts[:reciprocal_gender]}
        -- age BETWEEN age_min AND age_max, as a sargable birth_date range
        -- (identical to date_part('year', age(...)), Feb 29 included)
        AND p.birth_date <= (#{ph.(:as_of_date)}::date - make_interval(years => #{ph.(:age_min)}::int))::date
        AND p.birth_date > (#{ph.(:as_of_date)}::date - make_interval(years => #{ph.(:age_max)}::int + 1))::date
        AND #{ph.(:viewer_age)}::int BETWEEN dp.age_min AND dp.age_max
        AND p.looking_for && #{ph.(:intents)}::text[]
        AND NOT EXISTS (SELECT 1 FROM swipe_actions s
                        WHERE s.actor_profile_id = #{ph.(:viewer)}::uuid AND s.target_profile_id = p.id)
        -- Already said no to the viewer: a like would never be seen (the likes
        -- inbox only lists unanswered likes). Undo deletes the row, lifting it.
        AND NOT EXISTS (SELECT 1 FROM swipe_actions d
                        WHERE d.target_profile_id = #{ph.(:viewer)}::uuid AND d.actor_profile_id = p.id
                          AND d.action_type = 'dislike')
        AND NOT EXISTS (SELECT 1 FROM user_blocks b
                        WHERE b.actor_profile_id = #{ph.(:viewer)}::uuid AND b.target_profile_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM user_blocks b
                        WHERE b.actor_profile_id = p.id AND b.target_profile_id = #{ph.(:viewer)}::uuid)
        AND NOT EXISTS (SELECT 1 FROM profile_tags t
                        WHERE t.profile_id = p.id AND t.tag_id = ANY(#{ph.(:blocked_tags)}::uuid[]))
        AND NOT EXISTS (SELECT 1 FROM profile_blocked_tags bt
                        WHERE bt.profile_id = p.id AND bt.tag_id = ANY(#{ph.(:tags)}::uuid[]))
    )
    """
  end
end
