use rand::Rng;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

/// Nouns for random node name generation
const NOUNS: &[&str] = &[
    "falcon", "river", "summit", "spark", "wave", "flame", "storm", "frost",
    "dawn", "dusk", "moon", "star", "cloud", "breeze", "shadow", "echo",
    "forge", "bloom", "drift", "pulse", "glow", "nexus", "prism", "flux",
    "zenith", "aurora", "comet", "nebula", "quasar", "nova", "orbit", "beacon",
    "ember", "crystal", "thunder", "whisper", "canyon", "meadow", "harbor", "peak",
];

/// Generate a 5-character base32 hash for uniqueness
fn generate_short_hash(input: &str) -> String {
    let mut hasher = DefaultHasher::new();
    input.hash(&mut hasher);
    let hash = hasher.finish();

    // Convert to base32 (lowercase, 5 chars)
    // 32^5 = 33,554,432 possibilities
    const BASE32: &[u8] = b"abcdefghijklmnopqrstuvwxyz234567";
    let mut result = String::with_capacity(5);
    let mut h = hash;
    for _ in 0..5 {
        result.push(BASE32[(h & 0x1f) as usize] as char);
        h >>= 5;
    }
    result
}

/// Generate a unique node name with format: {noun}-{noun}-{hash}
/// Example: ember-river-k9q2m, storm-peak-a3b7x
///
/// This format provides:
/// - Human readability (two recognizable words)
/// - Guaranteed uniqueness via hash (33M+ possibilities)
/// - Collision check as safety net
pub fn generate_unique_node_name(existing_branches: &[String]) -> String {
    let mut rng = rand::thread_rng();

    // Try up to 10 times with different random seeds (virtually never needed)
    for attempt in 0..10 {
        // Pick two random nouns
        let noun1 = NOUNS[rng.gen_range(0..NOUNS.len())];
        let noun2 = NOUNS[rng.gen_range(0..NOUNS.len())];

        // Generate hash from UUID + attempt for uniqueness
        let unique_seed = format!("{}-{}", uuid::Uuid::new_v4(), attempt);
        let hash_suffix = generate_short_hash(&unique_seed);

        let name = format!("{}-{}-{}", noun1, noun2, hash_suffix);

        // Check for collision (safety net - extremely unlikely to trigger)
        if !existing_branches.contains(&name) {
            return name;
        }
    }

    // Fallback: pure UUID-based name (virtually impossible to reach)
    format!("node-{}", &uuid::Uuid::new_v4().to_string()[..8])
}

/// Generate both names from a unique hash-based name
/// Returns (display_name, internal_branch) - both are the same
pub fn generate_node_names(existing_branches: &[String]) -> (String, String) {
    let name = generate_unique_node_name(existing_branches);
    (name.clone(), name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_node_names() {
        let existing: Vec<String> = vec![];
        let (display_name, internal_branch) = generate_node_names(&existing);
        // Should have format: noun-noun-hash (two hyphens)
        let parts: Vec<&str> = internal_branch.split('-').collect();
        assert_eq!(parts.len(), 3, "Name should have format noun-noun-hash");
        // Hash should be 5 chars
        assert_eq!(parts[2].len(), 5, "Hash suffix should be 5 characters");
        // Display name should be same as internal branch
        assert_eq!(display_name, internal_branch);
    }

    #[test]
    fn test_generate_short_hash() {
        let hash1 = generate_short_hash("test-input-1");
        let hash2 = generate_short_hash("test-input-2");
        // Different inputs should produce different hashes
        assert_ne!(hash1, hash2);
        // Hash should be exactly 5 characters
        assert_eq!(hash1.len(), 5);
        assert_eq!(hash2.len(), 5);
        // Hash should only contain base32 characters
        assert!(hash1.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit()));
    }

    #[test]
    fn test_unique_name_avoids_collision() {
        // Create a name that would collide
        let first_name = generate_unique_node_name(&[]);
        // Generate another name with the first one as existing
        let existing = vec![first_name.clone()];
        let second_name = generate_unique_node_name(&existing);
        // Second name should be different
        assert_ne!(first_name, second_name);
    }

    #[test]
    fn test_names_are_unique() {
        let existing: Vec<String> = vec![];
        // Generate multiple names and ensure they're all unique
        let mut names = std::collections::HashSet::new();
        for _ in 0..100 {
            let name = generate_unique_node_name(&existing);
            assert!(names.insert(name), "Generated duplicate name");
        }
    }
}
