defmodule Cherry.Dating.Discovery.Ranking do
  @moduledoc "Integer score components and exact pruning of expensive fairness probes."

  @units 100
  @activity_points_24h 8
  @activity_points_72h 5
  @activity_points_7d 2
  @tag_affinity_points 45
  @same_intent_points 10
  @flow_intent_points 4
  @reciprocity_points 12
  @newcomer_points 8
  @newcomer_window_days 7
  @distance_points 10
  @exploration_points 4
  @fairness_max_penalty_points 6
  @fairness_likes_per_point 5
  @tag_affinity_units @tag_affinity_points * @units
  @same_intent_units @same_intent_points * @units
  @flow_intent_units @flow_intent_points * @units
  @reciprocity_units @reciprocity_points * @units
  @newcomer_units @newcomer_points * @units
  @newcomer_window_seconds @newcomer_window_days * 86_400
  @distance_units @distance_points * @units
  @exploration_modulo @exploration_points * @units + 1
  @fairness_max_units @fairness_max_penalty_points * @units
  @fairness_units_per_like div(@units, @fairness_likes_per_point)
  @fairness_max_pending @fairness_max_penalty_points * @fairness_likes_per_point

  def ctes(ph, opts, distance_scale) do
    # Fairness can only subtract up to six points. Among the best (limit + 1)
    # candidates whose *ceiling* is already after the cursor, even their worst
    # possible scores provide a safe floor. Candidates below it cannot enter the
    # page. Only contenders pay the per-like anti-join; the ranking stays exact.
    guaranteed =
      if opts[:cursor?],
        do:
          "(f.tier, -f.base_score_units, f.id) > (#{ph.(:cursor_tier)}::int, -#{ph.(:cursor_score)}::int, #{ph.(:cursor_id)}::uuid)",
        else: "TRUE"

    possible =
      if opts[:cursor?],
        do:
          "(f.tier, -f.base_score_units + #{@fairness_max_units}, f.id) > (#{ph.(:cursor_tier)}::int, -#{ph.(:cursor_score)}::int, #{ph.(:cursor_id)}::uuid)",
        else: "TRUE"

    contender_filter =
      if opts[:prune_fairness?],
        do:
          "#{possible} AND (NOT EXISTS (SELECT 1 FROM cutoff) OR f.tier < (SELECT tier FROM cutoff) OR (f.tier = (SELECT tier FROM cutoff) AND f.base_score_units >= (SELECT score_floor FROM cutoff)))",
        else: "TRUE"

    """
    score_ceilings AS MATERIALIZED (
      SELECT f.id, f.tier, f.distance_m, f.shared_tags_count, f.liked_viewer,
             (f.completed_at IS NOT NULL
              AND f.completed_at > #{ph.(:newcomer_since)}::timestamp) AS is_newcomer,
             (
               -- tag affinity (IDF-weighted Ochiai)
               LEAST(#{@tag_affinity_units}, ROUND(#{@tag_affinity_units} * CASE
                 WHEN f.shared_weight > 0
                   THEN f.shared_weight / sqrt((SELECT sum(weight) FROM viewer_tags) * f.total_weight)
                 ELSE 0 END))
               -- intent
               + CASE WHEN f.intents && #{ph.(:viewer_intents)}::text[] THEN #{@same_intent_units}
                      ELSE #{@flow_intent_units} END
               -- reciprocity
               + CASE WHEN f.liked_viewer THEN #{@reciprocity_units} ELSE 0 END
               -- newcomer boost, linear decay
               + CASE WHEN f.completed_at IS NULL THEN 0
                      ELSE ROUND(#{@newcomer_units} * GREATEST(0, LEAST(1,
                        1 - EXTRACT(EPOCH FROM (#{ph.(:as_of)}::timestamp - f.completed_at))
                            / #{@newcomer_window_seconds}.0)))
                 END
               -- activity
               + CASE
                   WHEN f.last_active_at > #{ph.(:as_of)}::timestamp - interval '24 hours'
                     THEN #{@activity_points_24h * @units}
                   WHEN f.last_active_at > #{ph.(:as_of)}::timestamp - interval '72 hours'
                     THEN #{@activity_points_72h * @units}
                   WHEN f.last_active_at > #{ph.(:as_of)}::timestamp - interval '7 days'
                     THEN #{@activity_points_7d * @units}
                   ELSE 0
                 END
               -- distance within the tier radius
               + ROUND(#{@distance_units} * GREATEST(0, 1 - f.distance_m / #{distance_scale}))
               -- deterministic exploration per pair
               + ('x' || substr(md5(#{ph.(:viewer)}::uuid::text || f.id::text), 1, 4))::bit(16)::int
                 % #{@exploration_modulo}
             )::int AS base_score_units
      FROM features f
    ),
    guaranteed AS MATERIALIZED (
      SELECT f.tier, f.base_score_units, f.id
      FROM score_ceilings f
      WHERE #{guaranteed}
      ORDER BY f.tier, f.base_score_units DESC, f.id
      LIMIT #{ph.(:limit)}::int
    ),
    cutoff AS (
      SELECT tier, base_score_units - #{@fairness_max_units} AS score_floor
      FROM guaranteed
      ORDER BY tier DESC, base_score_units, id DESC
      LIMIT 1
    ),
    ranked AS MATERIALIZED (
      SELECT f.id, f.tier, f.distance_m, f.shared_tags_count, f.liked_viewer, f.is_newcomer,
             (f.base_score_units - LEAST(#{@fairness_max_units}, pending.pending_likes * #{@fairness_units_per_like}))::int AS score_units
      FROM score_ceilings f
      CROSS JOIN LATERAL (
        SELECT (SELECT count(*) FROM (
                SELECT 1 FROM swipe_actions r
                WHERE r.target_profile_id = f.id AND r.action_type = 'like'
                  AND r.inserted_at > #{ph.(:fairness_since)}::timestamp
                  AND r.inserted_at <= #{ph.(:as_of)}::timestamp
                  -- OFFSET 0 keeps this a per-like probe of the unique
                  -- (actor, target) index instead of an anti join that reads
                  -- every swipe the candidate ever made.
                  AND NOT EXISTS (SELECT 1 FROM swipe_actions a
                                  WHERE a.actor_profile_id = f.id
                                    AND a.target_profile_id = r.actor_profile_id
                                  OFFSET 0)
                LIMIT #{@fairness_max_pending}
              ) pending)::int AS pending_likes
      ) pending
      WHERE #{contender_filter}
    )
    """
  end
end
