import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Upload, X, User, AlertCircle } from "lucide-react";

interface ChangePhotoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPhotoUrl?: string;
  userEmail: string;
}

export function ChangePhotoModal({ 
  open, 
  onOpenChange, 
  currentPhotoUrl, 
  userEmail 
}: ChangePhotoModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG, GIF, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    
    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      // Generate unique filename
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `avatar-${user.id}-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: publicUrl
        }
      });

      if (updateError) throw updateError;

      toast({
        title: "Photo updated",
        description: "Your profile photo has been updated successfully",
      });

      handleClose();
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to update profile photo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setRemoving(true);
    
    try {
      // Update user metadata to remove avatar
      const { error } = await supabase.auth.updateUser({
        data: {
          avatar_url: null
        }
      });

      if (error) throw error;

      toast({
        title: "Photo removed",
        description: "Your profile photo has been removed",
      });

      handleClose();
    } catch (error: any) {
      console.error('Error removing photo:', error);
      toast({
        title: "Failed to remove",
        description: error.message || "Failed to remove profile photo",
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    onOpenChange(false);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getUserInitials = (email: string) => {
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Change Profile Photo
          </DialogTitle>
          <DialogDescription>
            Upload a new profile photo or remove your current one
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Photo Preview */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage 
                  src={previewUrl || currentPhotoUrl} 
                  alt="Profile photo" 
                />
                <AvatarFallback className="text-lg">
                  <User className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
              {previewUrl && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                  onClick={clearSelection}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            <div className="text-sm text-muted-foreground text-center">
              {previewUrl 
                ? "New photo preview" 
                : currentPhotoUrl 
                ? "Current profile photo" 
                : "No profile photo set"
              }
            </div>
          </div>

          {/* File Input */}
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose New Photo
            </Button>

            {currentPhotoUrl && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRemovePhoto}
                disabled={removing}
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                {removing ? "Removing..." : "Remove Current Photo"}
              </Button>
            )}
          </div>

          {/* File Requirements */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p>Photo requirements:</p>
                <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                  <li>File format: JPG, PNG, GIF, or WebP</li>
                  <li>Maximum file size: 5MB</li>
                  <li>Recommended: Square aspect ratio (1:1)</li>
                  <li>Minimum size: 100x100 pixels</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {selectedFile && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Selected file:</div>
              <div className="text-xs text-muted-foreground">
                <div>Name: {selectedFile.name}</div>
                <div>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                <div>Type: {selectedFile.type}</div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {selectedFile && (
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload Photo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}