package com.kywky.notepadyyy;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NotepadFiles")
public class NotepadFilesPlugin extends Plugin {

    @PluginMethod
    public void openTextFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
            "text/*",
            "application/json",
            "application/xml",
            "application/javascript",
            "application/x-sh",
            "text/markdown"
        });

        try {
            startActivityForResult(call, intent, "handleOpenTextFile");
        } catch (Exception error) {
            call.reject("Could not open file picker.", error);
        }
    }

    @ActivityCallback
    private void handleOpenTextFile(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            call.resolve(ret);
            return;
        }

        Uri uri = result.getData().getData();

        try (InputStream inputStream = getContext().getContentResolver().openInputStream(uri)) {
            if (inputStream == null) {
                call.reject("Could not read selected file.");
                return;
            }

            JSObject ret = new JSObject();
            ret.put("name", getDisplayName(uri));
            ret.put("content", readText(inputStream));
            ret.put("uri", uri.toString());
            call.resolve(ret);
        } catch (Exception error) {
            call.reject("Could not read selected file.", error);
        }
    }

    @PluginMethod
    public void saveTextFile(PluginCall call) {
        String fileName = call.getString("fileName", "Untitled.txt");
        String mimeType = call.getString("mimeType", "text/plain;charset=utf-8");

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);

        try {
            startActivityForResult(call, intent, "handleSaveTextFile");
        } catch (Exception error) {
            call.reject("Could not open save dialog.", error);
        }
    }

    @ActivityCallback
    private void handleSaveTextFile(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            call.resolve(ret);
            return;
        }

        Uri uri = result.getData().getData();
        String content = call.getString("content", "");

        try (OutputStream outputStream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (outputStream == null) {
                call.reject("Could not write selected file.");
                return;
            }

            outputStream.write(content.getBytes(StandardCharsets.UTF_8));
            JSObject ret = new JSObject();
            ret.put("uri", uri.toString());
            call.resolve(ret);
        } catch (Exception error) {
            call.reject("Could not write selected file.", error);
        }
    }

    private String readText(InputStream inputStream) throws Exception {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] data = new byte[8192];
        int read;

        while ((read = inputStream.read(data, 0, data.length)) != -1) {
            buffer.write(data, 0, read);
        }

        return buffer.toString(StandardCharsets.UTF_8.name());
    }

    private String getDisplayName(Uri uri) {
        try (
            Cursor cursor = getContext()
                .getContentResolver()
                .query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)
        ) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    String name = cursor.getString(index);
                    if (name != null && !name.trim().isEmpty()) {
                        return name;
                    }
                }
            }
        } catch (Exception ignored) {
            // Fall through to the URI fallback below.
        }

        String fallback = uri.getLastPathSegment();
        return fallback == null || fallback.trim().isEmpty() ? "Untitled.txt" : fallback;
    }
}
