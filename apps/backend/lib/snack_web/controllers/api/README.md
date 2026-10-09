# API Controllers

HTTP entrypoints for authentication, sessions and the dating API.

`ProfileController` handles profile fields/completion. Preferences, photos, tags
and location have their own controllers; all keep the existing `/api/me/*` URLs.
Profile response serialization lives in `SnackWeb.OwnProfileJSON`, and Ecto
validation errors use `SnackWeb.ChangesetJSON`.
