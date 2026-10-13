defmodule Cherry.Repo.Migrations.ProfileLocationsPointsOnly do
  @moduledoc """
  `profile_locations.coordinates` only holds WGS 84 points.

  Until now `POST /api/me/location` stored a client-sent `coordinates` geometry
  as is (any type, no 500 m grid). Existing non-point rows are replaced by
  their centroid snapped to the same grid as `Cherry.Dating` (rows whose
  centroid is empty are deleted: the client sends a new location on its next
  update) and a CHECK constraint keeps it that way.
  """

  use Ecto.Migration

  def up do
    execute("""
    WITH bad AS (
      SELECT profile_id, ST_Centroid(coordinates::geometry) AS c
      FROM profile_locations
      WHERE GeometryType(coordinates::geometry) <> 'POINT'
         OR ST_IsEmpty(coordinates::geometry)
         OR ST_SRID(coordinates::geometry) <> 4326
    ),
    steps AS (
      SELECT profile_id, ST_X(c) AS lon, ST_Y(c) AS lat,
             500.0 / 111320.0 AS lat_step,
             500.0 / (111320.0 * GREATEST(abs(cos(radians(ST_Y(c)))), 0.01)) AS lon_step
      FROM bad
      WHERE NOT ST_IsEmpty(c)
    )
    UPDATE profile_locations pl
    SET coordinates = ST_SetSRID(ST_MakePoint(
          round((s.lon / s.lon_step)::numeric)::float8 * s.lon_step,
          round((s.lat / s.lat_step)::numeric)::float8 * s.lat_step), 4326)::geography,
        updated_at = now() AT TIME ZONE 'utc'
    FROM steps s
    WHERE pl.profile_id = s.profile_id
    """)

    execute("""
    DELETE FROM profile_locations
    WHERE GeometryType(coordinates::geometry) <> 'POINT'
       OR ST_IsEmpty(coordinates::geometry)
    """)

    execute("""
    ALTER TABLE profile_locations
      ADD CONSTRAINT profile_locations_coordinates_point
      CHECK (GeometryType(coordinates::geometry) = 'POINT'
             AND NOT ST_IsEmpty(coordinates::geometry)
             AND ST_SRID(coordinates::geometry) = 4326)
    """)
  end

  def down do
    execute(
      "ALTER TABLE profile_locations DROP CONSTRAINT IF EXISTS profile_locations_coordinates_point"
    )
  end
end
