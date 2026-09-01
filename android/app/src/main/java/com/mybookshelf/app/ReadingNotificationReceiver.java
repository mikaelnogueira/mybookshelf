package com.mybookshelf.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

public class ReadingNotificationReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        JSONArray quotes = ReadingNotificationPlugin.storedQuotes(context);
        if (quotes.length() == 0) return;
        SharedPreferences preferences = context.getSharedPreferences(ReadingNotificationPlugin.PREFS, Context.MODE_PRIVATE);
        int index = preferences.getInt("quote_index", 0) % quotes.length();
        JSONObject quote = quotes.optJSONObject(index);
        if (quote == null) return;
        String text = quote.optString("text", "Hora de reencontrar sua leitura.");
        String author = quote.optString("author", "MyBookshelf");
        String book = quote.optString("book", "Sua biblioteca");
        ReadingNotificationPlugin.post(context, author, text, book, 9100 + index);
        preferences.edit().putInt("quote_index", (index + 1) % quotes.length()).apply();
    }
}
