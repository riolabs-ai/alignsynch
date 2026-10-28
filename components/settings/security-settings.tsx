"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Loader2, LogOut, Shield } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

export function SecuritySettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Password updated successfully!");
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Security Settings</h3>
        <p className="text-sm text-muted-foreground">Manage your account security and authentication methods.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your password to keep your account secure.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input id="current-password" type="password" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input id="confirm-password" type="password" required />
            </div>

            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>Add an extra layer of security to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">{twoFactorEnabled ? "Your account is protected with two-factor authentication." : "Protect your account with two-factor authentication."}</p>
              </div>
            </div>
            <Switch checked={twoFactorEnabled} onCheckedChange={setTwoFactorEnabled} />
          </div>

          {twoFactorEnabled && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium">Setup Instructions</p>
              <ol className="mt-2 text-sm space-y-2 list-decimal list-inside">
                <li>Download an authenticator app like Google Authenticator or Authy</li>
                <li>Scan the QR code below with your authenticator app</li>
                <li>Enter the verification code from your app</li>
              </ol>
              <div className="mt-4 flex justify-center">
                <div className="bg-white p-4 rounded-lg">
                  <Image src="/qr-code-generic.png" alt="QR Code" className="h-32 w-32" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="verification-code">Verification Code</Label>
                <div className="flex space-x-2">
                  <Input id="verification-code" placeholder="Enter 6-digit code" />
                  <Button>Verify</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>Manage devices where you're currently logged in.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Current Device</p>
                <p className="text-sm text-muted-foreground">Chrome on Windows • New York, USA • Active now</p>
              </div>
              <Button variant="outline" size="sm" disabled>
                Current
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">iPhone 13</p>
                <p className="text-sm text-muted-foreground">Safari on iOS • Boston, USA • 2 days ago</p>
              </div>
              <Button variant="outline" size="sm">
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">MacBook Pro</p>
                <p className="text-sm text-muted-foreground">Firefox on macOS • San Francisco, USA • 5 days ago</p>
              </div>
              <Button variant="outline" size="sm">
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="destructive" className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Log Out of All Devices
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible and destructive actions for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
            <div className="flex items-center space-x-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="font-medium">Delete Account</p>
                <p className="text-sm text-muted-foreground">Permanently delete your account and all associated data.</p>
              </div>
            </div>
            <Button variant="destructive">Delete Account</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
