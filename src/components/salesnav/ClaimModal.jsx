import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ClaimModal({ account, onConfirm, onClose }) {
  const [name, setName] = useState("");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Claim Account</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-3">
          Claiming: <strong>{account.first_name} {account.last_name}</strong>
        </p>
        <Input
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!name.trim()} onClick={() => onConfirm(name.trim())}>
            Claim
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}