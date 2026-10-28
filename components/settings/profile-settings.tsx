"use client";

import type React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ProfileSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "Alex Johnson",
    username: "quizmaster",
    email: "alex@example.com",
    bio: "Quiz enthusiast and creator. I love making educational content!",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Profile updated successfully!");
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Profile Information</h3>
        <p className="text-sm text-muted-foreground">Update your profile information and how others see you on the platform.</p>
      </div>

      <div className="flex items-center gap-4">
        <Avatar className="h-24 w-24">
          <AvatarImage src="/avatars/alex.png" className="object-cover object-center" alt="Profile" />
          <AvatarFallback>AJ</AvatarFallback>
        </Avatar>

        <div className="space-y-2">
          <Button variant="outline" size="sm" className="relative">
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
            <Camera className="mr-2 h-4 w-4" />
            Change Avatar
          </Button>
          <p className="text-xs text-muted-foreground">JPG, PNG or GIF. 1MB max.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" name="username" value={formData.username} onChange={handleChange} required />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" name="bio" value={formData.bio} onChange={handleChange} rows={4} placeholder="Tell us about yourself" />
          <p className="text-xs text-muted-foreground">Brief description for your profile. URLs are hyperlinked.</p>
        </div>

        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </form>
    </div>
  );
}
