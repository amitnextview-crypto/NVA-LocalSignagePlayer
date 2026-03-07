package com.signageplayertv;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

import java.util.HashMap;
import java.util.Map;

public class NativeVideoPlayerManager extends SimpleViewManager<NativeVideoPlayerView> {
    public static final String REACT_CLASS = "NativeVideoPlayerView";

    @NonNull
    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @NonNull
    @Override
    protected NativeVideoPlayerView createViewInstance(@NonNull ThemedReactContext reactContext) {
        return new NativeVideoPlayerView(reactContext, reactContext);
    }

    @ReactProp(name = "src")
    public void setSrc(NativeVideoPlayerView view, @Nullable String src) {
        view.setSrc(src);
    }

    @ReactProp(name = "muted", defaultBoolean = true)
    public void setMuted(NativeVideoPlayerView view, boolean muted) {
        view.setMuted(muted);
    }

    @ReactProp(name = "repeat", defaultBoolean = false)
    public void setRepeat(NativeVideoPlayerView view, boolean repeat) {
        view.setRepeat(repeat);
    }

    @ReactProp(name = "resizeMode")
    public void setResizeMode(NativeVideoPlayerView view, @Nullable String resizeMode) {
        view.setResizeMode(resizeMode);
    }

    @Nullable
    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        Map<String, Object> events = new HashMap<>();
        events.put("topEnd", MapBuilder.of("registrationName", "onEnd"));
        events.put("topError", MapBuilder.of("registrationName", "onError"));
        events.put("topReady", MapBuilder.of("registrationName", "onReady"));
        return events;
    }
}
