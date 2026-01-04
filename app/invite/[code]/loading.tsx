import { Loader2 } from "lucide-react";

export default function InviteLoading() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f7f7f5]">
            <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-sm border border-[#e9e9e9] text-center">
                <Loader2 className="h-12 w-12 animate-spin text-[#7b7c7e] mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-[#1a1b1e] mb-2">Processing Invitation...</h2>
                <p className="text-[#7b7c7e]">Please wait while we add you to the workspace.</p>
            </div>
        </div>
    );
}
