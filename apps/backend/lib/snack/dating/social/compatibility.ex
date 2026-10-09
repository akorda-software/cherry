defmodule Snack.Dating.Social.Compatibility do
  @moduledoc "Reciprocal hard filters shared by social cards, swipes and received likes."
  import Ecto.Query
  alias Snack.Dating.{Discovery, DiscoveryPreference, Profile}
  alias Snack.Repo

  # ── Hard filters ───────────────────────────────────────────────────────

  # Hard discovery filters between the viewer and the profile bound as `:other`
  # (feed rules, see `Snack.Dating.Discovery`), evaluated for a single target.
  def compatible?(%Profile{} = viewer, target_id) do
    today = Date.utc_today()

    from(p in Profile, as: :other, where: p.id == ^target_id, select: 1)
    |> apply_viewer_side_filters(viewer, today)
    |> apply_other_side_filters(viewer, today)
    |> Repo.exists?()
  end

  # Filters the viewer imposes (and tag blocks, which are symmetric): what the
  # likes inbox applies to every liker.
  def apply_viewer_side_filters(query, %Profile{id: viewer_id} = viewer, today) do
    query
    # Tag blocks apply in both directions, as in discovery.
    |> where(
      [other: p],
      fragment(
        "NOT EXISTS (SELECT 1 FROM profile_tags pt JOIN profile_blocked_tags vb ON vb.tag_id = pt.tag_id WHERE pt.profile_id = ? AND vb.profile_id = ?)",
        p.id,
        type(^viewer_id, :binary_id)
      )
    )
    |> where(
      [other: p],
      fragment(
        "NOT EXISTS (SELECT 1 FROM profile_blocked_tags lb JOIN profile_tags vt ON vt.tag_id = lb.tag_id WHERE lb.profile_id = ? AND vt.profile_id = ?)",
        p.id,
        type(^viewer_id, :binary_id)
      )
    )
    |> apply_viewer_preferences(preferences_for(viewer), viewer_id, today)
    |> apply_intent_compatibility(viewer.looking_for)
  end

  # Filters the other person imposes on the viewer (their gender/age
  # preferences and their `compatible_only`), waived while they have a pending
  # like to the viewer: that like is their consent, as in the likes inbox.
  defp apply_other_side_filters(query, %Profile{id: viewer_id} = viewer, today) do
    viewer_age = viewer.birth_date && Profile.age_on(viewer.birth_date, today)

    where(
      query,
      [other: p],
      fragment(
        "EXISTS (SELECT 1 FROM swipe_actions l WHERE l.actor_profile_id = ? AND l.target_profile_id = ? AND l.action_type = 'like' AND NOT EXISTS (SELECT 1 FROM swipe_actions r WHERE r.actor_profile_id = l.target_profile_id AND r.target_profile_id = l.actor_profile_id))",
        p.id,
        type(^viewer_id, :binary_id)
      ) or
        fragment(
          "NOT EXISTS (SELECT 1 FROM discovery_preferences dp WHERE dp.profile_id = ? AND (NOT COALESCE(CASE ?::text WHEN 'man' THEN dp.show_men WHEN 'woman' THEN dp.show_women WHEN 'non_binary' THEN dp.show_non_binary END, false) OR NOT COALESCE(?::int BETWEEN dp.age_min AND dp.age_max, false) OR (dp.compatible_only AND NOT EXISTS (SELECT 1 FROM profile_tags a JOIN profile_tags b ON b.tag_id = a.tag_id JOIN tags t ON t.id = a.tag_id AND t.is_active WHERE a.profile_id = ? AND b.profile_id = ?))))",
          p.id,
          ^viewer.gender,
          ^viewer_age,
          p.id,
          type(^viewer_id, :binary_id)
        )
    )
  end

  defp preferences_for(%Profile{discovery_preference: %DiscoveryPreference{} = pref}), do: pref

  defp preferences_for(%Profile{id: viewer_id}),
    do: Repo.get_by(DiscoveryPreference, profile_id: viewer_id)

  defp apply_viewer_preferences(query, nil, _viewer_id, _today), do: query

  defp apply_viewer_preferences(query, %DiscoveryPreference{} = pref, viewer_id, today) do
    genders =
      [{"man", pref.show_men}, {"woman", pref.show_women}, {"non_binary", pref.show_non_binary}]
      |> Enum.filter(&elem(&1, 1))
      |> Enum.map(&elem(&1, 0))

    query =
      from([other: p] in query,
        where: p.gender in ^genders,
        # Same sargable birth_date range and UTC date as the feed (Feb 29 included).
        where:
          fragment(
            "? <= (?::date - make_interval(years => ?::int))::date",
            p.birth_date,
            ^today,
            ^pref.age_min
          ),
        where:
          fragment(
            "? > (?::date - make_interval(years => ?::int + 1))::date",
            p.birth_date,
            ^today,
            ^pref.age_max
          )
      )

    if pref.compatible_only do
      where(
        query,
        [other: p],
        fragment(
          "EXISTS (SELECT 1 FROM profile_tags a JOIN profile_tags b ON b.tag_id = a.tag_id JOIN tags t ON t.id = a.tag_id AND t.is_active WHERE a.profile_id = ? AND b.profile_id = ?)",
          p.id,
          type(^viewer_id, :binary_id)
        )
      )
    else
      query
    end
  end

  # Same symmetric intent rule as the feed ("a ver qué pasa" sees everyone;
  # relationship and casual never cross; with several intents, any compatible
  # pair is enough): the other's intents overlap the viewer's compatible set.
  defp apply_intent_compatibility(query, nil), do: query

  defp apply_intent_compatibility(query, intents) do
    compatible = Discovery.compatible_intents(intents)

    from([other: p] in query,
      where: fragment("? && ?::text[]", p.looking_for, type(^compatible, {:array, :string}))
    )
  end
end
