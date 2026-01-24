# Frontend Implementation Plan: S3 Document Display Fix

## Summary

The backend now returns a presigned download URL (`fileUrl`) directly in the `GET /operators/documents` response. The frontend needs to be updated to use this URL and fix the document type comparison.

---

## Backend Changes (Already Complete ✅)

The API response for `GET /operators/documents` now returns:

```json
{
  "success": true,
  "data": [
    {
      "id": "cmkof9a8o00015k1fig6bn3v",
      "documentType": "OPERATING_LICENSE",
      "fileName": "WhatsApp_Image_2026-01-14.jpeg",
      "fileUrl": "https://bucket.s3.amazonaws.com/operators/xxx/license/...",
      "uploadedAt": "2026-01-21T19:34:30.617Z",
      "expiresAt": null,
      "urlExpiresIn": 3600
    }
  ]
}
```

**Key Changes:**
- `documentType` returns enum values (`OPERATING_LICENSE`, `INSURANCE`, `OTHER`), NOT `license`/`insurance`
- `fileUrl` is a presigned S3 URL (valid for 1 hour)
- `urlExpiresIn` indicates seconds until URL expires

---

## Frontend Changes Required

### 1. Update `OperatorDocument` Interface

**File:** `lib/api/operator.api.ts`

```typescript
export interface OperatorDocument {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl?: string;        // NEW: Presigned download URL
  uploadedAt: string;
  expiresAt: string | null;
  urlExpiresIn?: number;   // NEW: Seconds until URL expires
}
```

---

### 2. Fix Document Type Comparison

**File:** `app/operator/profile/_components/OperatorProfileContent.tsx`

**Current (Broken):**
```typescript
const licenseDoc = documents.find((d) => d.documentType === 'license');
const insuranceDoc = documents.find((d) => d.documentType === 'insurance');
```

**Fixed:**
```typescript
const licenseDoc = documents.find((d) => d.documentType === 'OPERATING_LICENSE');
const insuranceDoc = documents.find((d) => d.documentType === 'INSURANCE');
```

---

### 3. Update `DocumentUpload` Component for Image Preview

**File:** `components/ui/DocumentUpload.tsx`

When `existingDocument` has a `fileUrl`, display the image preview:

```tsx
if (existingDocument && uploadState !== 'uploading') {
  const expiryStatus = getExpiryStatus(existingDocument.expiresAt);
  const isImage = existingDocument.fileName.match(/\.(jpg|jpeg|png)$/i);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      {/* Image Preview */}
      {isImage && existingDocument.fileUrl && (
        <div className="mb-3">
          <img 
            src={existingDocument.fileUrl} 
            alt={existingDocument.fileName}
            className="h-32 w-auto rounded-lg object-cover"
          />
        </div>
      )}
      {/* Rest of existing file info display... */}
    </div>
  );
}
```

---

### 4. Simplify Download Handler

**File:** `components/ui/DocumentUpload.tsx`

Use `fileUrl` directly instead of making an extra API call:

```tsx
const handleDownload = async () => {
  if (!existingDocument) return;
  
  // Use fileUrl directly if available
  const url = existingDocument.fileUrl || await getDocumentDownloadUrl(existingDocument.id);
  window.open(url, '_blank');
};
```

---

### 5. Admin Operator Details Page

**File:** `app/admin/operators/[id]/page.tsx`

**Backend endpoint is ready:** `GET /admin/operators/:id/documents`

Add the API call to fetch operator documents:

```typescript
// Add to lib/api/admin.api.ts
export const getOperatorDocuments = async (operatorId: string): Promise<OperatorDocument[]> => {
  const response = await apiClient.get(`/admin/operators/${operatorId}/documents`);
  return response.data.data;
};
```

Response format:
```json
{
  "success": true,
  "data": [
    {
      "id": "doc-id",
      "documentType": "OPERATING_LICENSE",
      "fileName": "license.pdf",
      "fileUrl": "https://s3-presigned-url...",
      "uploadedAt": "2026-01-21T19:34:30.617Z",
      "expiresAt": null,
      "urlExpiresIn": 3600
    }
  ]
}
```

Then display documents in the admin page using the `fileUrl` directly.

---

## Document Type Enum Reference

| Frontend Upload Value | Backend Returns      |
|-----------------------|----------------------|
| `'license'`           | `'OPERATING_LICENSE'`|
| `'insurance'`         | `'INSURANCE'`        |
| `'other'`             | `'OTHER'`            |

---

## Testing Checklist

- [ ] Upload a new document → Verify it appears with correct type
- [ ] Refresh page → Documents load with image previews
- [ ] Click download → Opens document in new tab
- [ ] Delete document → Removes from list
- [ ] Check expired document display → Shows expiry warning
- [ ] Admin view → Can see operator documents (if endpoint added)

---

**Last Updated:** January 2026

