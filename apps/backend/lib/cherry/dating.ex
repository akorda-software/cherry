defmodule Cherry.Dating do
  @moduledoc """
  Public API for the dating domain. Implementation lives in focused modules for
  profiles, preferences, photos/uploads, tags, locations, matching, messaging,
  safety and analytics. Callers can keep using this context as those modules
  evolve independently.

  `Discovery`, `Social` and `Inbox` provide the ranked feed and enriched social
  reads. Shared write serialization belongs to `PairLock`.
  """

  # Profiles
  defdelegate list_profiles(), to: Cherry.Dating.Profiles
  defdelegate get_profile(id), to: Cherry.Dating.Profiles
  defdelegate get_profile_by_user(user_id), to: Cherry.Dating.Profiles
  defdelegate create_profile(attrs \\ %{}), to: Cherry.Dating.Profiles
  defdelegate upsert_profile_for_user(user_id, attrs \\ %{}), to: Cherry.Dating.Profiles
  defdelegate update_profile(profile, attrs), to: Cherry.Dating.Profiles
  defdelegate delete_profile(profile), to: Cherry.Dating.Profiles
  defdelegate change_profile(profile, attrs \\ %{}), to: Cherry.Dating.Profiles
  defdelegate profile_completion_missing(profile), to: Cherry.Dating.Profiles
  defdelegate profile_complete?(profile), to: Cherry.Dating.Profiles
  defdelegate set_profile_complete(profile), to: Cherry.Dating.Profiles
  defdelegate complete_profile(profile), to: Cherry.Dating.Profiles
  defdelegate sync_completed_profile_state(profile), to: Cherry.Dating.Profiles
  defdelegate pause_profile(profile), to: Cherry.Dating.Profiles
  defdelegate unpause_profile(profile), to: Cherry.Dating.Profiles
  defdelegate disable_profile(profile), to: Cherry.Dating.Profiles

  # Preferences
  defdelegate get_discovery_preference(profile_id), to: Cherry.Dating.Preferences
  defdelegate upsert_discovery_preference(profile_id, attrs), to: Cherry.Dating.Preferences
  defdelegate change_discovery_preference(preference, attrs \\ %{}), to: Cherry.Dating.Preferences

  # Photos
  defdelegate list_photos(profile_id), to: Cherry.Dating.Photos
  defdelegate create_photo(attrs \\ %{}), to: Cherry.Dating.Photos
  defdelegate delete_photo(photo), to: Cherry.Dating.Photos
  defdelegate reorder_photos(profile_id, ordered_photo_ids), to: Cherry.Dating.Photos

  # PhotoUploads
  defdelegate create_photo_upload_intent(profile, attrs), to: Cherry.Dating.PhotoUploads
  defdelegate complete_photo_upload(profile, attrs), to: Cherry.Dating.PhotoUploads

  # Tags
  defdelegate list_active_tags(), to: Cherry.Dating.Tags
  defdelegate get_tag(id), to: Cherry.Dating.Tags
  defdelegate create_tag(attrs \\ %{}), to: Cherry.Dating.Tags
  defdelegate set_profile_tags(profile_id, tag_ids), to: Cherry.Dating.Tags
  defdelegate set_profile_blocked_tags(profile_id, tag_ids), to: Cherry.Dating.Tags
  defdelegate get_profile_tags(profile_id), to: Cherry.Dating.Tags
  defdelegate get_profile_blocked_tags(profile_id), to: Cherry.Dating.Tags

  # Locations
  defdelegate update_client_location(profile_id, params), to: Cherry.Dating.Locations
  defdelegate upsert_location(attrs), to: Cherry.Dating.Locations
  defdelegate get_location(profile_id), to: Cherry.Dating.Locations

  # Matching
  defdelegate record_swipe(attrs), to: Cherry.Dating.Matching
  defdelegate list_matches(profile_id), to: Cherry.Dating.Matching
  defdelegate get_match(id), to: Cherry.Dating.Matching
  defdelegate unmatch(match_id), to: Cherry.Dating.Matching

  # Messaging
  defdelegate list_conversations(profile_id), to: Cherry.Dating.Messaging
  defdelegate get_conversation(id), to: Cherry.Dating.Messaging
  defdelegate list_messages(conversation_id, opts \\ []), to: Cherry.Dating.Messaging
  defdelegate send_message(attrs), to: Cherry.Dating.Messaging

  defdelegate get_messageable_conversation(conversation_id, profile_id),
    to: Cherry.Dating.Messaging

  defdelegate conversation_allows_messaging?(conversation_id, profile_id),
    to: Cherry.Dating.Messaging

  defdelegate conversation_messaging_status(conversation_id, profile_id),
    to: Cherry.Dating.Messaging

  # Safety
  defdelegate block_profile(attrs \\ %{}), to: Cherry.Dating.Safety
  defdelegate report_profile(attrs \\ %{}), to: Cherry.Dating.Safety
  defdelegate list_reports(status, opts \\ []), to: Cherry.Dating.Safety
  defdelegate update_report(report, attrs), to: Cherry.Dating.Safety

  # Analytics
  defdelegate track_event(attrs \\ %{}), to: Cherry.Dating.Analytics

  @doc "Returns a SQL-ranked discovery page with an opaque cursor."
  defdelegate discovery_feed(viewer_profile_id, opts \\ []),
    to: Cherry.Dating.Discovery,
    as: :feed
end
