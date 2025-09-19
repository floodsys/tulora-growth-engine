import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resolveNextPath } from "@/lib/navigation/resolveNextPath";

const CompleteProfile = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    // Redirect to /onboarding/organization preserving ?next= parameter
    const nextParam = searchParams.get('next');
    const targetPath = '/onboarding/organization';
    
    if (nextParam) {
      // Preserve the next parameter
      const safeNext = resolveNextPath(nextParam);
      navigate(`${targetPath}?next=${encodeURIComponent(safeNext)}`, { replace: true });
    } else {
      navigate(targetPath, { replace: true });
    }
  }, [navigate, searchParams]);

  return null; // This component just redirects
};

export default CompleteProfile;