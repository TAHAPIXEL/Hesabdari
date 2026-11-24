package ir.novinashpazkhaneh.hesabdari;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileNotFoundException;

public final class BackupFileProvider extends ContentProvider {

    public static Uri getUriForFile(Context context, File file) {
        String authority = context.getPackageName() + ".fileprovider";
        return new Uri.Builder()
                .scheme("content")
                .authority(authority)
                .appendPath("shared")
                .appendPath(file.getName())
                .build();
    }

    private File resolveFile(Uri uri) throws FileNotFoundException {
        Context ctx = getContext();
        if (ctx == null || uri == null) {
            throw new FileNotFoundException("Invalid context or URI");
        }
        String name = uri.getLastPathSegment();
        if (name == null || name.contains("..") || name.contains("/")) {
            throw new FileNotFoundException("Invalid file name");
        }
        File dir = new File(ctx.getCacheDir(), "shared");
        File target = new File(dir, name);
        if (!target.exists()) {
            throw new FileNotFoundException("File not found: " + name);
        }
        return target;
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        try {
            File file = resolveFile(uri);
            String[] cols = projection != null ? projection : new String[]{
                    OpenableColumns.DISPLAY_NAME,
                    OpenableColumns.SIZE
            };
            String[] finalCols = new String[cols.length];
            Object[] values = new Object[cols.length];
            int i = 0;
            for (String col : cols) {
                if (OpenableColumns.DISPLAY_NAME.equals(col)) {
                    finalCols[i] = OpenableColumns.DISPLAY_NAME;
                    values[i] = file.getName();
                    i++;
                } else if (OpenableColumns.SIZE.equals(col)) {
                    finalCols[i] = OpenableColumns.SIZE;
                    values[i] = file.length();
                    i++;
                }
            }
            String[] trimmedCols = new String[i];
            Object[] trimmedVals = new Object[i];
            System.arraycopy(finalCols, 0, trimmedCols, 0, i);
            System.arraycopy(values, 0, trimmedVals, 0, i);
            MatrixCursor cursor = new MatrixCursor(trimmedCols, 1);
            cursor.addRow(trimmedVals);
            return cursor;
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public String getType(Uri uri) {
        String name = uri != null ? uri.getLastPathSegment() : null;
        if (name != null) {
            if (name.endsWith(".json")) return "application/json";
            if (name.endsWith(".csv")) return "text/csv";
            int dot = name.lastIndexOf('.');
            if (dot >= 0) {
                String ext = name.substring(dot + 1).toLowerCase();
                String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
                if (mime != null) return mime;
            }
        }
        return "application/octet-stream";
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Read-only provider");
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Read-only provider");
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = resolveFile(uri);
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }
}
