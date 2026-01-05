# Create Request Dialog - Bug Fixes

## Issues Identified

### 1. "Select a person" Dropdown Not Opening ❌
**Problem:** The dropdown doesn't open when clicked
**Root Cause:** Dialog z-index conflicts with Select Portal OR empty members list

### 2. "Auto-Draft" Button 500 Error ❌  
**Problem:** `/api/ai/draft-request` returns 500 Internal Server Error
**Root Cause:** Likely missing OpenAI API key or rate limit issue

---

## Fixes

### Fix 1: Ensure SelectContent Has Higher Z-Index

The `SelectContent` is rendered in a Portal but might have z-index conflicts with Dialog overlay.

**File:** `components/ui/select.tsx` (Line 65)

Current z-index: `z-50`
Dialog overlay typically uses: `z-50`

**Solution:** Increase SelectContent z-index to `z-[100]`

```typescript
// Line 65 in select.tsx
className={cn(
  "bg-popover text-popover-foreground ... relative z-[100] max-h-(--radix-select-content-available-height) ...",
  //Changed from z-50 to z-[100] ^
```

### Fix 2: Debug Members List Loading

Add console logging to check if members are being fetched:

**File:** `components/graph/CreateRequestDialog.tsx` (Line 71)

```typescript
if (membersRes.ok) {
  const data = await membersRes.json();
  console.log('✅ Members loaded:', data.members); // Add this
  setMembers(data.members || []);
}
```

### Fix 3: Fix Auto-Draft API Error

Check OpenAI API configuration:

**File:** `lib/ai/openai.ts`

Ensure:
1. `OPENAI_API_KEY` is set in `.env.local`
2. Rate limiting is not blocking requests
3. Error handling catches and logs properly

**Quick Test:**
```bash
# Check if OpenAI key is set
grep OPENAI_API_KEY .env.local

# If not set, add it:
echo "OPENAI_API_KEY=sk-your-key-here" >> .env.local
```

---

## Testing Plan

1. **Test Select Dropdown:**
   - Open Create Request dialog
   - Click "Select a person..."
   - Verify dropdown opens and shows members
   - Check browser console for member loading logs

2. **Test Auto-Draft:**
   - Enter some context in Question field  
   - Click "Auto-Draft" button
   - Verify it generates a draft message
   - Check Network tab for 200 response from `/api/ai/draft-request`

---

## Quick Debugging Commands

```bash
# 1. Check server logs
cd /Users/xavi/Desktop/real_code/Node/Node
npm run dev

# 2. Test API directly
curl -X POST http://localhost:3000/api/ai/draft-request \
  -H "Content-Type: application/json" \
  -d '{"nodeId":"test-node-id"}'

# 3. Check members API
curl http://localhost:3000/api/projects/PROJECT_ID/members
```
