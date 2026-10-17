defmodule Cherry.Casework.Case do
  use Ecto.Schema
  import Ecto.Changeset
  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "casework_cases" do
    field(:kind, :string)
    field(:category, :string)
    field(:statement, :string, redact: true)
    field(:status, :string, default: "open")
    field(:requester_user_id, :binary_id)
    field(:subject_user_id, :binary_id)
    field(:report_id, :binary_id)
    field(:parent_case_id, :binary_id)
    field(:assigned_staff_id, :binary_id)
    field(:decided_by_staff_id, :binary_id)
    field(:outcome, :string)
    field(:response, :string, redact: true)
    field(:reporter_response, :string, redact: true)
    field(:resolved_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  def outcomes(%__MODULE__{kind: "report"}), do: ~w(dismissed warning suspend)
  def outcomes(%__MODULE__{kind: "measure"}), do: []
  def outcomes(%__MODULE__{kind: "appeal"}), do: ~w(upheld overturned)
  def outcomes(%__MODULE__{}), do: ~w(answered refused)

  def request_changeset(case_record, attrs) do
    case_record
    |> cast(attrs, [:kind, :category, :statement])
    |> update_change(:statement, &String.trim/1)
    |> validate_required([:kind, :category, :statement])
    |> validate_length(:statement, min: 10, max: 4000)
  end

  def resolution_changeset(case_record, attrs, outcomes) do
    case_record
    |> cast(attrs, [:outcome, :response, :reporter_response])
    |> update_change(:response, &String.trim/1)
    |> update_change(:reporter_response, &String.trim/1)
    |> validate_required([:outcome, :response])
    |> validate_inclusion(:outcome, outcomes)
    |> validate_length(:response, min: 20, max: 4000)
    |> validate_length(:reporter_response, min: 20, max: 4000)
    |> then(fn changeset ->
      if case_record.kind == "report",
        do: validate_required(changeset, [:reporter_response]),
        else: changeset
    end)
  end
end
