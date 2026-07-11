package com.farshadfard.sarmayeman;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private OnBackPressedCallback backCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        backCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleNativeBack();
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backCallback);
    }

    private void handleNativeBack() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            finish();
            return;
        }

        WebView webView = getBridge().getWebView();
        webView.evaluateJavascript(
            "Boolean(window.__sarmayeManHandleAndroidBack && window.__sarmayeManHandleAndroidBack())",
            handled -> {
                if (!"true".equals(handled)) {
                    backCallback.setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    backCallback.setEnabled(true);
                }
            }
        );
    }
}
