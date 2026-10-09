defmodule Snack.Dating do
  @moduledoc """
  Public API for the dating domain. Implementation lives in focused modules for
  profiles, preferences, photos/uploads, tags, locations, matching, messaging,
  safety and analytics. Callers can keep using this context as those modules
  evolve independently.

  `Discovery`, `Social` and `Inbox` provide the ranked feed and enriched social
  reads. Shared write serialization belongs to `PairLock`.
  """

  # Profiles
  defdelegate list_profiles(), to: Snack.Dating.Profiles
  defdelegate get_profile(id), to: Snack.Dating.Profiles
  defdelegate get_profile_by_user(user_id), to: Snack.Dating.Profiles
  defdelegate create_profile(attrs \\ %{}), to: Snack.Dating.Profiles
  defdelegate upsert_profile_for_user(user_id, attrs \\ %{}), to: Snack.Dating.Profiles
  defdelegate update_profile(profile, attrs), to: Snack.Dating.Profiles
  defdelegate delete_profile(profile), to: Snack.Dating.Profiles
  defdelegate change_profile(profile, attrs \\ %{}), to: Snack.Dating.Profiles
  defdelegate profile_completion_missing(profile), to: Snack.Dating.Profiles
  defdelegate profile_complete?(profile), to: Snack.Dating.Profiles
  defdelegate set_profile_complete(profile), to: Snack.Dating.Profiles
  defdelegate complete_profile(profile), to: Snack.Dating.Profiles
  defdelegate sync_completed_profile_state(profile), to: Snack.Dating.Profiles
  defdelegate pause_profile(profile), to: Snack.Dating.Profiles
  defdelegate unpause_profile(profile), to: Snack.Dating.Profiles
  defdelegate disable_profile(profile), to: Snack.Dating.Profiles

  # Preferences
  defdelegate get_discovery_preference(profile_id), to: Snack.Dating.Preferences
  defdelegate upsert_discovery_preference(profile_id, attrs), to: Snack.Dating.Preferences
  defdelegate change_discovery_preference(preference, attrs \\ %{}), to: Snack.Dating.Preferences

  # Photos
  defdelegate list_photos(profile_id), to: Snack.Dating.Photos
  defdelegate create_photo(attrs \\ %{}), to: Snack.Dating.Photos
  defdelegate delete_photo(photo), to: Snack.Dating.Photos
  defdelegate reorder_photos(profile_id, ordered_photo_ids), to: Snack.Dating.Photos

  # PhotoUploads
  defdelegate create_photo_upload_intent(profile, attrs), to: Snack.Dating.PhotoUploads
  defdelegate complete_photo_upload(profile, attrs), to: Snack.Dating.PhotoUploads

  # Tags
  defdelegate list_active_tags(), to: Snack.Dating.Tags
  defdelegate get_tag(id), to: Snack.Dating.Tags
  defdelegate create_tag(attrs \\ %{}), to: Snack.Dating.Tags
  defdelegate set_profile_tags(profile_id, tag_ids), to: Snack.Dating.Tags
  defdelegate set_profile_blocked_tags(profile_id, tag_ids), to: Snack.Dating.Tags
  defdelegate get_profile_tags(profile_id), to: Snack.Dating.Tags
  defdelegate get_profile_blocked_tags(profile_id), to: Snack.Dating.Tags

  # Locations
  defdelegate update_client_location(profile_id, params), to: Snack.Dating.Locations
  defdelegate upsert_location(attrs), to: Snack.Dating.Locations
  defdelegate get_location(profile_id), to: Snack.Dating.Locations

  # Matching
  defdelegate record_swipe(attrs), to: Snack.Dating.Matching
  defdelegate list_matches(profile_id), to: Snack.Dating.Matching
  defdelegate get_match(id), to: Snack.Dating.Matching
  defdelegate unmatch(match_id), to: Snack.Dating.Matching

  # Messaging
  defdelegate list_conversations(profile_id), to: Snack.Dating.Messaging
  defdelegate get_conversation(id), to: Snack.Dating.Messaging
  defdelegate list_messages(conversation_id, opts \\ []), to: Snack.Dating.Messaging
  defdelegate send_message(attrs), to: Snack.Dating.Messaging

  defdelegate get_messageable_conversation(conversation_id, profile_id),
    to: Snack.Dating.Messaging

  defdelegate conversation_allows_messaging?(conversation_id, profile_id),
    to: Snack.Dating.Messaging

  defdelegate conversation_messaging_status(conversation_id, profile_id),
    to: Snack.Dating.Messaging

  # Safety
  defdelegate block_profile(attrs \\ %{}), to: Snack.Dating.Safety
  defdelegate report_profile(attrs \\ %{}), to: Snack.Dating.Safety
  defdelegate list_reports(status, opts \\ []), to: Snack.Dating.Safety
  defdelegate update_report(report, attrs), to: Snack.Dating.Safety

  # Analytics
  defdelegate track_event(attrs \\ %{}), to: Snack.Dating.Analytics

  @doc "Returns a SQL-ranked discovery page with an opaque cursor."
  defdelegate discovery_feed(viewer_profile_id, opts \\ []), to: Snack.Dating.Discovery, as: :feed
end
