package com.mybookshelf.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONArray;

@CapacitorPlugin(name = "ReadingNotifications", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class ReadingNotificationPlugin extends Plugin {
    static final String CHANNEL_ID = "reading_reminders";
    static final String PREFS = "mybookshelf_notifications";
    static final String QUOTES = "quotes";
    static final long INTERVAL = 2L * 60L * 60L * 1000L;

    @PluginMethod
    public void initialize(PluginCall call) {
        createChannel(getContext());
        SharedPreferences preferences = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!preferences.getBoolean("welcome_shown", false) && NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            post(getContext(), "Bem-vindo ao MyBookshelf", "Sua biblioteca está pronta para acompanhar cada nova leitura.", "Primeiro acesso", 9001);
            preferences.edit().putBoolean("welcome_shown", true).apply();
        }
        schedule(getContext());
        call.resolve();
    }

    @PluginMethod
    public void updateQuotes(PluginCall call) {
        JSArray quotes = call.getArray("quotes", new JSArray());
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(QUOTES, quotes.toString()).apply();
        schedule(getContext());
        call.resolve();
    }

    static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Lembretes de leitura", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Frases e lembretes relacionados à sua biblioteca");
            context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    static void schedule(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, ReadingNotificationReceiver.class);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 2200, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        alarmManager.cancel(pendingIntent);
        alarmManager.setInexactRepeating(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + INTERVAL, INTERVAL, pendingIntent);
    }

    static void post(Context context, String title, String text, String subText, int id) {
        createChannel(context);
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        PendingIntent contentIntent = PendingIntent.getActivity(context, id, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title).setContentText(text).setSubText(subText)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(contentIntent).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_DEFAULT);
        try { NotificationManagerCompat.from(context).notify(id, notification.build()); } catch (SecurityException ignored) { }
    }

    static JSONArray storedQuotes(Context context) {
        try { return new JSONArray(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(QUOTES, "[]")); }
        catch (Exception ignored) { return new JSONArray(); }
    }
}
