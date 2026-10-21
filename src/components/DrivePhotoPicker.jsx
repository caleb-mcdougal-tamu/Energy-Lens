import React, { useEffect, useState } from "react";
import { ChevronRight, Folder, HardDrive, Users, Search, Check, Loader2, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DriveImage from "@/components/DriveImage";
import { FOLDER_MIME, listPage, listSharedDrives, q } from "@/lib/google/drive";
import { cn } from "@/lib/utils";

const FIELDS = "id,name,mimeType,thumbnailLink,createdTime,imageMediaMetadata(time)";
const KINDS = `(mimeType = '${FOLDER_MIME}' or mimeType contains 'image/')`;
const PAGE_SIZE = 200;

const SOURCES = [
  { key: "my", label: "My Drive", icon: HardDrive },
  { key: "shared", label: "Shared with me", icon: Users },
  { key: "drives", label: "Shared drives", icon: Folder },
];

function queryFor(location, search) {
  if (search) return `trashed = false and mimeType contains 'image/' and name contains '${q(search)}'`;
  if (location.source === "shared" && !location.folderId) return `trashed = false and sharedWithMe and ${KINDS}`;
  return `trashed = false and '${q(location.folderId || "root")}' in parents and ${KINDS}`;
}

// Browse the user's Google Drive (My Drive, Shared with me, shared drives)
// and select photos to add. Works the same on phones and desktops.
export default function DrivePhotoPicker({ open, onClose, onPick, excludeFolderId }) {
  const [source, setSource] = useState("my");
  const [path, setPath] = useState([]); // [{ id, name }]
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [items, setItems] = useState([]);
  const [drives, setDrives] = useState(null);
  const [nextPage, setNextPage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Map());

  const folderId = path.length ? path[path.length - 1].id : null;
  const showDriveList = source === "drives" && !folderId && !submittedSearch;

  useEffect(() => {
    if (!open) return;
    setSelected(new Map());
  }, [open]);

  const load = async (pageToken) => {
    setLoading(true);
    setError(null);
    try {
      const page = await listPage(queryFor({ source, folderId }, submittedSearch), {
        fields: FIELDS,
        pageSize: PAGE_SIZE,
        pageToken,
        orderBy: submittedSearch ? "modifiedTime desc" : "folder,name_natural",
      });
      const files = (page.files || []).filter((f) => f.id !== excludeFolderId);
      setItems((prev) => (pageToken ? [...prev, ...files] : files));
      setNextPage(page.nextPageToken || null);
    } catch (e) {
      setError(e.message || "Couldn't load Drive.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (showDriveList) {
      setItems([]);
      setNextPage(null);
      if (drives === null) {
        setLoading(true);
        listSharedDrives()
          .then(setDrives)
          .catch((e) => setError(e.message))
          .finally(() => setLoading(false));
      }
      return;
    }
    load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source, folderId, submittedSearch]);

  const chooseSource = (key) => {
    setSource(key);
    setPath([]);
    setSearch("");
    setSubmittedSearch("");
  };

  const openFolder = (f) => {
    setSubmittedSearch("");
    setSearch("");
    setPath((p) => [...p, { id: f.id, name: f.name }]);
  };

  const toggle = (f) =>
    setSelected((s) => {
      const n = new Map(s);
      if (n.has(f.id)) n.delete(f.id);
      else n.set(f.id, f);
      return n;
    });

  const folders = items.filter((f) => f.mimeType === FOLDER_MIME);
  const images = items.filter((f) => f.mimeType !== FOLDER_MIME);
  const imagesSelected = images.length > 0 && images.every((f) => selected.has(f.id));

  const selectAllHere = () =>
    setSelected((s) => {
      const n = new Map(s);
      if (imagesSelected) images.forEach((f) => n.delete(f.id));
      else images.forEach((f) => n.set(f.id, f));
      return n;
    });

  const sourceLabel = SOURCES.find((s) => s.key === source)?.label;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl h-[90vh] sm:h-[80vh] flex flex-col gap-3 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Add photos from Google Drive</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SOURCES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => chooseSource(key)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium border",
                source === key && !submittedSearch
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmittedSearch(search.trim());
          }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!e.target.value) setSubmittedSearch("");
            }}
            placeholder="Search photos by file name"
            className="pl-9"
          />
        </form>

        <nav className="flex items-center gap-1 text-sm overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {submittedSearch ? (
            <span className="text-neutral-500">Results for &ldquo;{submittedSearch}&rdquo;</span>
          ) : (
            <>
              <button onClick={() => setPath([])} className={cn(path.length ? "text-neutral-500 hover:text-neutral-900" : "font-medium text-neutral-900")}>
                {sourceLabel}
              </button>
              {path.map((p, i) => (
                <React.Fragment key={p.id}>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
                  <button
                    onClick={() => setPath((cur) => cur.slice(0, i + 1))}
                    className={cn("max-w-[40vw] truncate", i === path.length - 1 ? "font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-900")}
                  >
                    {p.name}
                  </button>
                </React.Fragment>
              ))}
            </>
          )}
          {images.length > 0 && (
            <button onClick={selectAllHere} className="ml-auto pl-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 shrink-0">
              {imagesSelected ? "Clear" : "Select all"}
            </button>
          )}
        </nav>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
          {error && <p className="text-sm text-red-600 py-2">{error}</p>}

          {showDriveList &&
            (drives || []).map((d) => (
              <button
                key={d.id}
                onClick={() => openFolder(d)}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-neutral-50 text-left"
              >
                <HardDrive className="h-5 w-5 text-neutral-400 shrink-0" />
                <span className="truncate text-sm text-neutral-800">{d.name}</span>
              </button>
            ))}
          {showDriveList && drives && drives.length === 0 && !loading && (
            <p className="py-10 text-center text-sm text-neutral-400">No shared drives.</p>
          )}

          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => openFolder(f)}
              className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-neutral-50 text-left"
            >
              <Folder className="h-5 w-5 text-neutral-400 shrink-0" />
              <span className="truncate text-sm text-neutral-800 flex-1">{f.name}</span>
              <ChevronRight className="h-4 w-4 text-neutral-300 shrink-0" />
            </button>
          ))}

          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
              {images.map((f) => {
                const sel = selected.has(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggle(f)}
                    title={f.name}
                    className={cn(
                      "relative aspect-square rounded-xl overflow-hidden bg-neutral-100 ring-1 transition",
                      sel ? "ring-2 ring-neutral-900" : "ring-neutral-200/60 hover:ring-neutral-300"
                    )}
                  >
                    <DriveImage
                      photo={{ id: f.id, thumbnail_link: f.thumbnailLink }}
                      size={300}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <span
                      className={cn(
                        "absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full border",
                        sel ? "bg-neutral-900 border-neutral-900 text-white" : "bg-white/80 border-neutral-300"
                      )}
                    >
                      {sel && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && !error && !showDriveList && items.length === 0 && (
            <div className="py-10 text-center text-sm text-neutral-400">
              <ImageIcon className="h-6 w-6 mx-auto mb-2 text-neutral-300" />
              No folders or photos here.
            </div>
          )}

          {loading && (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
            </div>
          )}
          {!loading && nextPage && (
            <div className="py-3 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => load(nextPage)}>
                Load more
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center gap-2 sm:gap-2">
          <span className="mr-auto text-sm text-neutral-500">
            {selected.size ? `${selected.size} selected` : "Copies are added; originals stay put."}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!selected.size} onClick={() => onPick([...selected.values()])}>
            Add {selected.size || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
