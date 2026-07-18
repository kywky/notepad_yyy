package com.kywky.notepadyyy;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NotepadFilesPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onBackPressed() {
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript("window.dispatchEvent(new Event('notepadNativeBack'))", null);
    }
}
