package com.kywky.notepadyyy;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NotepadFilesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
