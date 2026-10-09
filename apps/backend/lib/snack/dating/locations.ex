defmodule Snack.Dating.Locations do
  @moduledoc "Location persistence, privacy grid and atomic client throttling."

  import Ecto.Query
  import Ecto.Changeset, only: [add_error: 3]

  alias Snack.Repo
  alias Snack.Dating.Profile
  alias Snack.Dating.ProfileLocation

  # ── Location ──────────────────────────────────────────────────────────

  @location_min_interval_seconds 60

  @doc """
  Location sent by the mobile client (`POST /api/me/location`). Only
  `latitude`/`longitude` are accepted (always snapped to the 500 m privacy
  grid) plus optional `accuracy_meters`/`recorded_at`; any other key (such as a
  GeoJSON `coordinates`) is ignored.

  Updates less than #{@location_min_interval_seconds} s after the previous one
  are ignored and return the stored location unchanged: repeated fast moves
  would help triangulate someone through the distance labels.
  """
  def update_client_location(profile_id, params) when is_map(params) do
    attrs =
      %{
        "profile_id" => profile_id,
        "latitude" => location_value(params, :latitude, "latitude"),
        "longitude" => location_value(params, :longitude, "longitude"),
        "accuracy_meters" =>
          location_value(params, :accuracy_meters, "accuracy_meters", "accuracyMeters"),
        "recorded_at" => location_value(params, :recorded_at, "recorded_at", "recordedAt")
      }
      |> Enum.reject(fn {_key, value} -> is_nil(value) end)
      |> Map.new()

    if Map.has_key?(attrs, "latitude") and Map.has_key?(attrs, "longitude") do
      Repo.transaction(fn ->
        # Serialize the read and write, including the first location (where
        # there is no location row to lock yet). Concurrent coordinates inside
        # the privacy interval must all return the same stored point.
        Repo.one!(from p in Profile, where: p.id == ^profile_id, lock: "FOR UPDATE", select: p.id)

        case recent_location(profile_id) do
          nil ->
            case upsert_location(attrs) do
              {:ok, location} -> location
              {:error, changeset} -> Repo.rollback(changeset)
            end

          location ->
            location
        end
      end)
    else
      {:error, invalid_location_changeset(:coordinates, "latitude and longitude are required")}
    end
  end

  defp recent_location(profile_id) do
    case get_location(profile_id) do
      %ProfileLocation{updated_at: %DateTime{} = updated_at} = location ->
        if DateTime.diff(DateTime.utc_now(), updated_at) < @location_min_interval_seconds,
          do: location

      _none ->
        nil
    end
  end

  @doc """
  Inserts or updates a profile's location (internal use: seeds, tests,
  `update_client_location/2`). Accepts `latitude`/`longitude` (snapped to the
  500 m grid) or `coordinates` as a `%Geo.Point{srid: 4326}`; any other
  geometry is rejected.
  """
  def upsert_location(attrs) do
    with {:ok, attrs} <- normalize_location_attrs(attrs) do
      profile_id = attrs["profile_id"]

      case Repo.get(ProfileLocation, profile_id) do
        nil ->
          %ProfileLocation{profile_id: profile_id}
          |> ProfileLocation.changeset(attrs)
          |> Repo.insert()

        loc ->
          loc
          |> ProfileLocation.changeset(attrs)
          |> Repo.update()
      end
    end
  end

  @doc """
  Gets a profile's location.
  """
  def get_location(profile_id) do
    Repo.get(ProfileLocation, profile_id)
  end

  defp normalize_location_attrs(attrs) do
    attrs =
      %{
        "profile_id" => location_value(attrs, :profile_id, "profile_id"),
        "coordinates" => location_value(attrs, :coordinates, "coordinates"),
        "latitude" => location_value(attrs, :latitude, "latitude"),
        "longitude" => location_value(attrs, :longitude, "longitude"),
        "accuracy_meters" =>
          location_value(attrs, :accuracy_meters, "accuracy_meters", "accuracyMeters"),
        "recorded_at" => location_value(attrs, :recorded_at, "recorded_at", "recordedAt")
      }
      |> Enum.reject(fn {_key, value} -> is_nil(value) end)
      |> Map.new()

    cond do
      Map.has_key?(attrs, "coordinates") ->
        case attrs["coordinates"] do
          %Geo.Point{coordinates: {longitude, latitude}, srid: 4326}
          when is_number(longitude) and is_number(latitude) ->
            case validate_coordinate_bounds(latitude, longitude) do
              :ok -> {:ok, attrs}
              _error -> {:error, invalid_location_changeset(:coordinates, "out of bounds")}
            end

          _other ->
            {:error, invalid_location_changeset(:coordinates, "must be a WGS 84 point")}
        end

      Map.has_key?(attrs, "latitude") and Map.has_key?(attrs, "longitude") ->
        with {:ok, latitude} <- parse_coordinate(attrs["latitude"]),
             {:ok, longitude} <- parse_coordinate(attrs["longitude"]),
             :ok <- validate_coordinate_bounds(latitude, longitude) do
          {:ok, Map.put(attrs, "coordinates", approximate_point(latitude, longitude))}
        else
          _error ->
            {:error,
             invalid_location_changeset(:coordinates, "must be valid latitude and longitude")}
        end

      true ->
        {:ok, attrs}
    end
  end

  defp location_value(attrs, atom_key, string_key) do
    Map.get(attrs, string_key) || Map.get(attrs, atom_key)
  end

  defp location_value(attrs, atom_key, string_key, camel_key) do
    Map.get(attrs, camel_key) || location_value(attrs, atom_key, string_key)
  end

  defp parse_coordinate(value) when is_integer(value), do: {:ok, value / 1}
  defp parse_coordinate(value) when is_float(value), do: {:ok, value}

  defp parse_coordinate(value) when is_binary(value) do
    case Float.parse(value) do
      {coordinate, ""} -> {:ok, coordinate}
      _value -> {:error, :invalid_coordinate}
    end
  end

  defp parse_coordinate(_value), do: {:error, :invalid_coordinate}

  defp validate_coordinate_bounds(latitude, longitude) do
    if latitude >= -90 and latitude <= 90 and longitude >= -180 and longitude <= 180 do
      :ok
    else
      {:error, :invalid_coordinate}
    end
  end

  defp approximate_point(latitude, longitude) do
    grid_meters = 500.0
    latitude_step = grid_meters / 111_320.0

    longitude_step =
      grid_meters / (111_320.0 * max(abs(:math.cos(latitude * :math.pi() / 180)), 0.01))

    approximated_latitude = round_to_grid(latitude, latitude_step)
    approximated_longitude = round_to_grid(longitude, longitude_step)

    %Geo.Point{coordinates: {approximated_longitude, approximated_latitude}, srid: 4326}
  end

  defp round_to_grid(value, step) do
    value
    |> Kernel./(step)
    |> Float.round(0)
    |> Kernel.*(step)
    |> Float.round(6)
  end

  defp invalid_location_changeset(field, message) do
    %ProfileLocation{}
    |> ProfileLocation.changeset(%{})
    |> add_error(field, message)
  end
end
