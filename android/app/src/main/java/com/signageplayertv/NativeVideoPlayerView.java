package com.signageplayertv;

import android.content.Context;
import android.net.Uri;
import android.view.LayoutInflater;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;
import com.google.android.exoplayer2.DefaultLoadControl;
import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.MediaItem;
import com.google.android.exoplayer2.PlaybackException;
import com.google.android.exoplayer2.Player;
import com.google.android.exoplayer2.source.DefaultMediaSourceFactory;
import com.google.android.exoplayer2.upstream.DefaultHttpDataSource;
import com.google.android.exoplayer2.ui.AspectRatioFrameLayout;
import com.google.android.exoplayer2.ui.StyledPlayerView;

public class NativeVideoPlayerView extends FrameLayout implements LifecycleEventListener {
    private final ReactContext reactContext;
    private final StyledPlayerView playerView;
    private ExoPlayer player;
    private String src = "";
    private boolean muted = true;
    private boolean repeat = false;
    private String resizeMode = "stretch";
    private float rotation = 0f;
    private boolean attached = false;

    public NativeVideoPlayerView(@NonNull Context context, @NonNull ReactContext reactContext) {
        super(context);
        this.reactContext = reactContext;
        LayoutInflater.from(context).inflate(R.layout.native_video_player_view, this, true);
        this.playerView = findViewById(R.id.native_video_player_surface);
        this.playerView.setLayoutParams(new LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        applyResizeMode();
        applyRotation();
        reactContext.addLifecycleEventListener(this);
    }

    public void setSrc(String value) {
        String next = value == null ? "" : value.trim();
        if (next.equals(this.src)) return;
        this.src = next;
        prepareIfPossible();
    }

    public void setMuted(boolean value) {
        this.muted = value;
        if (player != null) {
            player.setVolume(value ? 0f : 1f);
        }
    }

    public void setRepeat(boolean value) {
        this.repeat = value;
        if (player != null) {
            player.setRepeatMode(value ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF);
        }
    }

    public void setResizeMode(String value) {
        this.resizeMode = value == null ? "stretch" : value;
        applyResizeMode();
    }

    public void setVideoRotation(float value) {
        this.rotation = value;
        applyRotation();
    }

    private void ensurePlayer() {
        if (player != null) return;

        DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(
                        5000,
                        30000,
                        2000,
                        5000
                )
                .build();

        DefaultHttpDataSource.Factory httpFactory = new DefaultHttpDataSource.Factory()
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(30000);

        player = new ExoPlayer.Builder(getContext())
                .setLoadControl(loadControl)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(httpFactory))
                .build();
        playerView.setPlayer(player);
        player.setVolume(muted ? 0f : 1f);
        player.setRepeatMode(repeat ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF);
        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_READY) {
                    dispatchEvent("topReady", null);
                }
                if (playbackState == Player.STATE_ENDED && !repeat) {
                    dispatchEvent("topEnd", null);
                }
            }

            @Override
            public void onPlayerError(@NonNull PlaybackException error) {
                WritableMap event = Arguments.createMap();
                event.putString("message", error.getMessage());
                dispatchEvent("topError", event);
            }
        });
    }

    private void prepareIfPossible() {
        if (!attached || src.isEmpty()) return;
        ensurePlayer();
        MediaItem mediaItem = MediaItem.fromUri(Uri.parse(src));
        player.setMediaItem(mediaItem);
        player.prepare();
        player.play();
    }

    private void applyResizeMode() {
        int mode = AspectRatioFrameLayout.RESIZE_MODE_FILL;
        if ("cover".equalsIgnoreCase(resizeMode)) {
            mode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM;
        } else if ("contain".equalsIgnoreCase(resizeMode)) {
            mode = AspectRatioFrameLayout.RESIZE_MODE_FIT;
        }
        playerView.setResizeMode(mode);
    }

    private void applyRotation() {
        playerView.setRotation(rotation);
    }

    private void dispatchEvent(String eventName, WritableMap payload) {
        reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
                getId(),
                eventName,
                payload
        );
    }

    private void releasePlayer() {
        if (player != null) {
            player.release();
            player = null;
        }
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        attached = true;
        prepareIfPossible();
    }

    @Override
    protected void onDetachedFromWindow() {
        attached = false;
        releasePlayer();
        super.onDetachedFromWindow();
    }

    @Override
    public void onHostResume() {
        prepareIfPossible();
    }

    @Override
    public void onHostPause() {
        if (player != null) {
            player.pause();
        }
    }

    @Override
    public void onHostDestroy() {
        releasePlayer();
    }
}
