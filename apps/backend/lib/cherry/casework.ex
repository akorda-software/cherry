defmodule Cherry.Casework do
  @moduledoc """
  Casework boundary. Intake, private inbox, staff review and decision effects
  have separate owners; controllers do not implement workflow or permissions.
  """
  alias Cherry.Casework.{Case, Inbox, Intake, Pagination, Review}

  defdelegate privacy_categories(), to: Intake
  defdelegate outcomes(record), to: Case
  defdelegate intake_report!(report), to: Intake
  defdelegate submit(user, attrs), to: Intake
  defdelegate appeal(user, id, attrs), to: Intake
  defdelegate list_for_user(user, offset \\ 0), to: Inbox
  defdelegate get_for_user(user, id), to: Inbox
  defdelegate notices(user, offset \\ 0), to: Inbox
  defdelegate appealed_ids(user, records), to: Inbox
  defdelegate read_notice(user, id), to: Inbox
  defdelegate queue(staff, params \\ %{}), to: Review
  defdelegate view(staff, id), to: Review
  defdelegate claim(staff, id), to: Review
  defdelegate reassign(staff, id), to: Review
  defdelegate resolve(staff, id, attrs), to: Review
  defdelegate offset(params), to: Pagination
end
