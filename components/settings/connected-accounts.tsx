"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Facebook, Github, Loader2, Twitter } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ConnectedAccounts() {
  const [isLoading, setIsLoading] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState({
    google: true,
    facebook: false,
    twitter: true,
    github: false,
  });

  const handleConnect = (account: string) => {
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setConnectedAccounts((prev) => ({
        ...prev,
        [account]: true,
      }));
      setIsLoading(false);
      toast.success("Account connected successfully!");
    }, 1000);
  };

  const handleDisconnect = (account: string) => {
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setConnectedAccounts((prev) => ({
        ...prev,
        [account]: false,
      }));
      setIsLoading(false);
      toast.success("Account disconnected successfully!");
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Connected Accounts</h3>
        <p className="text-sm text-muted-foreground">Connect your accounts for easier login and sharing.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Social Accounts</CardTitle>
          <CardDescription>Connect your social media accounts to QuizHub .</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-[#4285F4] text-white p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  <path d="M1 1h22v22H1z" fill="none" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Google</p>
                <p className="text-sm text-muted-foreground">{connectedAccounts.google ? "Connected as alex@example.com" : "Not connected"}</p>
              </div>
            </div>
            {connectedAccounts.google ? (
              <Button variant="outline" size="sm" onClick={() => handleDisconnect("google")} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Disconnect
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => handleConnect("google")} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect
              </Button>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-[#1877F2] text-white p-2 rounded-full">
                <Facebook className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Facebook</p>
                <p className="text-sm text-muted-foreground">{connectedAccounts.facebook ? "Connected as Alex Johnson" : "Not connected"}</p>
              </div>
            </div>
            {connectedAccounts.facebook ? (
              <Button variant="outline" size="sm" onClick={() => handleDisconnect("facebook")} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Disconnect
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => handleConnect("facebook")} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect
              </Button>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-[#1DA1F2] text-white p-2 rounded-full">
                <Twitter className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Twitter</p>
                <p className="text-sm text-muted-foreground">{connectedAccounts.twitter ? "Connected as @quizmaster" : "Not connected"}</p>
              </div>
            </div>
            {connectedAccounts.twitter ? (
              <Button variant="outline" size="sm" onClick={() => handleDisconnect("twitter")} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Disconnect
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => handleConnect("twitter")} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect
              </Button>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-[#333] text-white p-2 rounded-full">
                <Github className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">GitHub</p>
                <p className="text-sm text-muted-foreground">{connectedAccounts.github ? "Connected as alexjohnson" : "Not connected"}</p>
              </div>
            </div>
            {connectedAccounts.github ? (
              <Button variant="outline" size="sm" onClick={() => handleDisconnect("github")} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Disconnect
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => handleConnect("github")} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
