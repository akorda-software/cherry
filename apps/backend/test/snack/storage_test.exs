defmodule Snack.StorageTest do
  use ExUnit.Case, async: false

  alias Snack.Storage

  setup do
    previous = Application.get_env(:snack, Storage)
    on_exit(fn -> Application.put_env(:snack, Storage, previous) end)
  end

  test "dispatches to the configured adapter and fails closed without one" do
    Application.put_env(:snack, Storage, adapter: nil)

    assert {:error, :storage_not_configured} = Storage.upload_config()
    assert {:error, :storage_not_configured} = Storage.presign_put("profiles/a.jpg", "image/jpeg")
    assert {:error, :storage_not_configured} = Storage.public_url("profiles/a.jpg")

    assert {:error, :storage_not_configured} =
             Storage.verify_upload(%{storage_key: "k", content_type: "image/jpeg", size_bytes: 1})

    Application.put_env(:snack, Storage, adapter: Snack.Storage.Local)
    assert {:ok, "/uploads/profiles/a.jpg"} = Storage.public_url("profiles/a.jpg")
  end

  test "checks magic bytes against the declared type and maps extensions" do
    assert Storage.image_signature?(<<255, 216, 255, 224>>, "image/jpeg")
    assert Storage.image_signature?(<<137, 80, 78, 71, 13, 10, 26, 10>>, "image/png")
    assert Storage.image_signature?(<<"RIFF", 0::32, "WEBPVP8L">>, "image/webp")
    refute Storage.image_signature?(<<"RIFF", 0::32, "WEBPXXXX">>, "image/webp")
    refute Storage.image_signature?(<<255, 216, 255, 224>>, "image/png")
    refute Storage.image_signature?("GIF89a", "image/gif")

    assert Enum.map(~w(image/jpeg image/png image/webp image/gif), &Storage.extension_for/1) ==
             ~w(jpg png webp bin)

    assert Storage.content_type_for_key("profiles/p/a.JPG") == "image/jpeg"
    assert Storage.content_type_for_key("profiles/p/a.webp") == "image/webp"
    assert Storage.content_type_for_key("profiles/p/a.gif") == nil
  end
end
