import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { User, Building, Users, Briefcase, Mail, ArrowLeft, RefreshCw } from "lucide-react";
import logo from "@/assets/logo.svg";

interface ProfileData {
  user_id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  organization_name: string | null;
  organization_size: string | null;
  industry: string | null;
  created_at: string;
  updated_at: string;
}

const ProfileTest = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  const fetchProfile = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('No profile found for this user');
        } else {
          throw fetchError;
        }
      } else {
        setProfile(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchProfile();
    } else if (!authLoading && !user) {
      setLoading(false);
      setError('User not authenticated');
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile data...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>You need to be logged in to view profile data</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Link to="/auth">
              <Button>Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src={logo} alt="Logo" className="h-8 w-auto" />
              <div>
                <h1 className="text-xl font-bold">Profile Test Page</h1>
                <p className="text-sm text-muted-foreground">End-to-end profile verification</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchProfile}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Link to="/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Auth Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Authentication Info
              </CardTitle>
              <CardDescription>Current authentication state</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User ID</label>
                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded">{user.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm">{user.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Provider</label>
                  <Badge variant="secondary">{user.app_metadata?.provider || 'email'}</Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email Confirmed</label>
                  <Badge variant={user.email_confirmed_at ? "default" : "destructive"}>
                    {user.email_confirmed_at ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Profile Data
                {profile ? (
                  <Badge variant="default">Found</Badge>
                ) : (
                  <Badge variant="destructive">Not Found</Badge>
                )}
              </CardTitle>
              <CardDescription>Data stored in the profiles table</CardDescription>
            </CardHeader>
            <CardContent>
              {error ? (
                <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
                  <p className="font-medium">Error:</p>
                  <p className="text-sm">{error}</p>
                </div>
              ) : profile ? (
                <div className="space-y-6">
                  {/* Personal Info */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Personal Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                        <p className="text-sm">{profile.full_name || 'Not set'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">First Name</label>
                        <p className="text-sm">{profile.first_name || 'Not set'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                        <p className="text-sm">{profile.last_name || 'Not set'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Organization Info */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Organization Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Organization Name</label>
                        <p className="text-sm">{profile.organization_name || 'Not set'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Organization Size
                        </label>
                        <p className="text-sm">{profile.organization_size || 'Not set'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          Industry
                        </label>
                        <p className="text-sm">{profile.industry || 'Not set'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Contact Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Email</label>
                        <p className="text-sm">{profile.email || 'Not set'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">User ID</label>
                        <p className="text-sm font-mono">{profile.user_id}</p>
                      </div>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Timestamps</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Created At</label>
                        <p className="text-sm">{formatDate(profile.created_at)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Updated At</label>
                        <p className="text-sm">{formatDate(profile.updated_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-muted-foreground">No profile data found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This user may need to complete their profile setup
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Test Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Test Cases</CardTitle>
              <CardDescription>Verify these scenarios work correctly</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold">✅ Email/Password Signup</h4>
                  <p className="text-sm text-muted-foreground">
                    After signup with all fields → should land in dashboard with profile row created; this page shows values.
                  </p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-semibold">✅ OAuth Signup</h4>
                  <p className="text-sm text-muted-foreground">
                    After OAuth signup → see "Complete your profile" once, then this page shows values.
                  </p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-semibold">✅ Re-login</h4>
                  <p className="text-sm text-muted-foreground">
                    After re-login → no extra prompts; profile persists and shows here.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfileTest;