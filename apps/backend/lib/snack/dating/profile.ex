defmodule Snack.Dating.Profile do
  use Ecto.Schema

  import Ecto.Changeset

  alias Snack.Accounts.User
  alias Snack.Dating.DiscoveryPreference
  alias Snack.Dating.ProfilePhoto
  alias Snack.Dating.ProfileLocation

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @genders ["man", "woman", "non_binary"]
  @relationship_intents ["relationship", "casual", "meet_people", "go_with_the_flow"]

  schema "profiles" do
    field(:display_name, :string)
    field(:birth_date, :date)
    field(:gender, :string)

    # «¿Qué buscas?»: 1–4 intenciones, sin repetir, en orden canónico. NULL = sin contestar.
    field(:looking_for, {:array, :string})
    field(:bio, :string)
    field(:is_complete, :boolean, default: false)
    field(:is_paused, :boolean, default: false)
    field(:is_discoverable, :boolean, default: false)
    field(:deleted_at, :utc_datetime)
    # Discovery ranking v2: newcomer boost and real activity (D-2026-09-29).
    field(:completed_at, :utc_datetime)
    field(:last_active_at, :utc_datetime)

    belongs_to(:user, User)
    has_one(:discovery_preference, DiscoveryPreference)
    has_many(:photos, ProfilePhoto)
    has_one(:location, ProfileLocation)
    many_to_many(:tags, Snack.Dating.Tag, join_through: "profile_tags", on_replace: :delete)

    many_to_many(:blocked_tags, Snack.Dating.Tag,
      join_through: "profile_blocked_tags",
      on_replace: :delete
    )

    timestamps(type: :utc_datetime)
  end

  def changeset(profile, attrs) do
    attrs = normalize_looking_for_attrs(attrs)

    profile
    |> cast(attrs, [
      :user_id,
      :display_name,
      :birth_date,
      :gender,
      :looking_for,
      :bio,
      :is_complete,
      :is_paused,
      :is_discoverable,
      :deleted_at
    ])
    |> validate_required([
      :user_id,
      :display_name,
      :birth_date,
      :gender,
      :looking_for,
      :bio
    ])
    |> validate_profile_fields()
    |> foreign_key_constraint(:user_id)
    |> unique_constraint(:user_id)
  end

  def draft_changeset(profile, attrs) do
    attrs = normalize_looking_for_attrs(attrs)

    profile
    |> cast(attrs, [:user_id, :display_name, :birth_date, :gender, :looking_for, :bio])
    |> validate_required([:user_id])
    |> validate_profile_fields()
    |> foreign_key_constraint(:user_id)
    |> unique_constraint(:user_id)
  end

  def system_changeset(profile, attrs) do
    cast(profile, attrs, [:is_complete, :is_paused, :is_discoverable, :deleted_at, :completed_at])
  end

  defp validate_profile_fields(changeset) do
    changeset
    |> validate_length(:display_name, min: 1, max: 50)
    |> validate_length(:bio, min: 20, max: 240)
    |> validate_inclusion(:gender, @genders)
    |> validate_looking_for()
  end

  # Non-empty when present (a draft may leave it NULL), a subset of the allowed
  # intents, no duplicates. Stored in canonical order so equal choices compare
  # equal and the output is deterministic.
  defp validate_looking_for(changeset) do
    changeset
    |> validate_length(:looking_for, min: 1, max: length(@relationship_intents))
    |> validate_subset(:looking_for, @relationship_intents)
    |> validate_change(:looking_for, fn :looking_for, intents ->
      if Enum.uniq(intents) == intents,
        do: [],
        else: [looking_for: {"has duplicate values", validation: :uniqueness}]
    end)
    |> then(fn changeset ->
      case get_change(changeset, :looking_for) do
        intents when is_list(intents) ->
          put_change(changeset, :looking_for, canonical_intents(intents))

        _other ->
          changeset
      end
    end)
  end

  @doc "Sorts `intents` in the canonical order of `relationship_intents/0`."
  def canonical_intents(intents) when is_list(intents) do
    Enum.sort_by(intents, fn intent ->
      Enum.find_index(@relationship_intents, &(&1 == intent)) || length(@relationship_intents)
    end)
  end

  @doc """
  True when `intents` is a valid complete answer: a non-empty list of allowed
  intents without duplicates.
  """
  def valid_looking_for?(intents) when is_list(intents) and intents != [] do
    Enum.uniq(intents) == intents and Enum.all?(intents, &(&1 in @relationship_intents))
  end

  def valid_looking_for?(_intents), do: false

  # Backwards compatibility: clients before the multi-choice step send the old
  # single `what_i_am_looking_for` (or `whatIAmLookingFor`) string. Any of the
  # accepted keys is mapped onto `looking_for`, and a single string becomes a
  # one-element list. `looking_for` wins when both are present.
  @looking_for_aliases [
    {"looking_for", :looking_for},
    {"lookingFor", :lookingFor},
    {"what_i_am_looking_for", :what_i_am_looking_for},
    {"whatIAmLookingFor", :whatIAmLookingFor}
  ]

  defp normalize_looking_for_attrs(attrs) when is_map(attrs) do
    found =
      Enum.find_value(@looking_for_aliases, fn {string_key, atom_key} ->
        cond do
          Map.has_key?(attrs, string_key) -> {:string, Map.fetch!(attrs, string_key)}
          Map.has_key?(attrs, atom_key) -> {:atom, Map.fetch!(attrs, atom_key)}
          true -> nil
        end
      end)

    case found do
      nil ->
        attrs

      {key_type, value} ->
        attrs =
          Map.drop(attrs, Enum.flat_map(@looking_for_aliases, fn {s, a} -> [s, a] end))

        value = if is_binary(value), do: [value], else: value
        key = if key_type == :string, do: "looking_for", else: :looking_for
        Map.put(attrs, key, value)
    end
  end

  defp normalize_looking_for_attrs(attrs), do: attrs

  def genders, do: @genders

  def relationship_intents, do: @relationship_intents

  def age(%{birth_date: nil}), do: nil

  def age(%{birth_date: %Date{} = birth_date}), do: age_on(birth_date, Date.utc_today())

  @doc """
  Edad cumplida en `today`. Compara (mes, día) en vez de construir el cumpleaños
  de este año, que sería una fecha inválida para quien nació un 29 de febrero
  (en años no bisiestos cumple el 1 de marzo).
  """
  def age_on(%Date{} = birth_date, %Date{} = today) do
    years = today.year - birth_date.year

    if {today.month, today.day} < {birth_date.month, birth_date.day} do
      years - 1
    else
      years
    end
  end
end
