import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Camera, Trash2 } from '@/lib/icons';
import { clubs as clubsApi } from '@/data/api';
import type { Club } from '@/data/types';
import { Modal, useConfirm } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, Input, Textarea } from './ui/Field';
import { Avatar } from './ui/Bits';
import { ImageCropDialog } from './ImageCropDialog';

/**
 * Name, description and picture for a club. Admins and mods can edit; only the
 * admin sees the delete button.
 */
export function EditClubDialog({
  open, club, isAdmin, onClose, onChanged, onDeleted,
}: {
  open: boolean;
  club: Club;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const confirm = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description ?? '');
  const [picked, setPicked] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(club.name);
      setDescription(club.description ?? '');
    }
  }, [open, club.name, club.description]);

  const save = async () => {
    setBusy(true);
    try {
      await clubsApi.update(club.id, { name: name.trim(), description: description.trim() });
      toast.success('Club updated');
      onChanged();
      onClose();
    } catch {
      /* the request layer already showed why */
    } finally {
      setBusy(false);
    }
  };

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setPicked(file);
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${club.name}?`,
      message: 'The club, its lists and its activity are removed for every member. This cannot be undone.',
      confirmLabel: 'Delete club',
      danger: true,
    });
    if (!ok) return;
    await clubsApi.remove(club.id);
    toast.success('Club deleted');
    onDeleted();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Edit club"
        width={480}
        footer={
          <>
            {isAdmin && (
              <Button variant="danger" icon={<Trash2 size={15} />} disabled={busy} onClick={remove}>
                Delete club
              </Button>
            )}
            <div className="grow" />
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!name.trim() || busy} onClick={save}>
              Save
            </Button>
          </>
        }
      >
        <div className="stack gap-4">
          <div className="row gap-3">
            <Avatar src={club.image_url} name={club.name} size={56} />
            <Button icon={<Camera size={15} />} onClick={() => fileInput.current?.click()}>
              Change picture
            </Button>
          </div>
          <Field label="Name">
            <Input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Description" hint={`${description.length}/500`}>
            <Textarea value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={pick} />
      </Modal>

      <ImageCropDialog
        file={picked}
        kind="avatar"
        name={club.name}
        onClose={() => setPicked(null)}
        onSave={async (cropped) => {
          await clubsApi.uploadImage(club.id, cropped);
          toast.success('Club picture updated');
          onChanged();
        }}
      />
    </>
  );
}
