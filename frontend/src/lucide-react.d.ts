// lucide-react v1.22.0 ships without resolvable type declarations
// (its `typings` field points to a file that isn't published), so TypeScript
// cannot find types for it. This bare ambient declaration lets us import any
// icon by name; icon components are typed as `any`, which is fine in practice.
declare module 'lucide-react'
