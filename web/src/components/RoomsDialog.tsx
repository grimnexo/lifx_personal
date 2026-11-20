import { useState } from 'react';
import { useApp } from '../context';
import type { Room } from '../types';
import { Modal, btnPrimary, btnSmall, input } from './ui';

export function RoomsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rooms, lights, updateRooms, ask } = useApp();
  const [newName, setNewName] = useState('');

  function setMember(mac: string, roomId: string, on: boolean) {
    updateRooms(
      rooms.map((r) => {
        const others = r.lights.filter((m) => m !== mac);
        if (r.id === roomId) return { ...r, lights: on ? [...others, mac] : others };
        return on ? { ...r, lights: others } : r;
      }),
    );
  }

  function add() {
    const name = newName.trim();
    if (!name) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    updateRooms([...rooms, { id, name, lights: [] }]);
    setNewName('');
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="roomsTitle">
      <h2 id="roomsTitle" className="m-0 mb-1 text-xl font-semibold">
        Rooms
      </h2>
      <p className="m-0 mb-4 text-[.9rem] text-mut">Group lights by room. A light belongs to one room at a time.</p>

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          className={input}
          maxLength={40}
          placeholder="New room, e.g. Living room"
          aria-label="New room name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className={btnPrimary} disabled={!newName.trim()}>
          Add room
        </button>
      </form>

      {rooms.length === 0 && <p className="text-mut">No rooms yet.</p>}
      <div className="grid gap-4">
        {rooms.map((r) => (
          <RoomEditor
            key={r.id}
            room={r}
            lights={lights}
            onRename={(name) => updateRooms(rooms.map((x) => (x.id === r.id ? { ...x, name } : x)))}
            onDelete={() =>
              ask(`Delete the room "${r.name}"? Its lights stay in your lights list.`, 'Delete room', () =>
                updateRooms(rooms.filter((x) => x.id !== r.id)),
              )
            }
            onMember={(mac, on) => setMember(mac, r.id, on)}
          />
        ))}
      </div>
    </Modal>
  );
}

function RoomEditor({
  room,
  lights,
  onRename,
  onDelete,
  onMember,
}: {
  room: Room;
  lights: { mac: string; label: string }[];
  onRename: (name: string) => void;
  onDelete: () => void;
  onMember: (mac: string, on: boolean) => void;
}) {
  const [draft, setDraft] = useState(room.name);
  const commit = () => {
    const name = draft.trim();
    if (name && name !== room.name) onRename(name);
    else setDraft(room.name);
  };
  return (
    <fieldset className="grid gap-2 rounded-xl border border-line p-3">
      <legend className="sr-only">Room {room.name}</legend>
      <div className="flex items-center gap-2">
        <input
          className={`${input} flex-1 font-semibold`}
          maxLength={40}
          aria-label="Room name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <button type="button" className={btnSmall} onClick={onDelete}>
          Delete
        </button>
      </div>
      {lights.length === 0 ? (
        <p className="m-0 text-[.85rem] text-mut">No lights found yet.</p>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {lights.map((l) => (
            <label key={l.mac} className="flex cursor-pointer items-center gap-2 text-[.9rem]">
              <input
                type="checkbox"
                checked={room.lights.includes(l.mac)}
                onChange={(e) => onMember(l.mac, e.target.checked)}
              />
              {l.label}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
