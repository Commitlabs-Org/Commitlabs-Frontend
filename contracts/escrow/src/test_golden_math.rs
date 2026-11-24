use super::{EscrowContract, RiskProfile, MAX_PENALTY_BPS};

const MATH_VECTORS: &str = include_str!("../../golden/math_vectors.json");

fn vector_objects(section: &str) -> Vec<&str> {
    let marker = format!("\"{section}\": [");
    let section_text = MATH_VECTORS
        .split_once(marker.as_str())
        .expect("golden vector section exists")
        .1;

    section_text
        .lines()
        .map(str::trim)
        .take_while(|line| !line.starts_with(']'))
        .filter(|line| line.starts_with('{'))
        .map(|line| line.strip_suffix(',').unwrap_or(line))
        .collect()
}

fn field<'a>(object: &'a str, key: &str) -> &'a str {
    let marker = format!("\"{key}\":");
    let value = object
        .split_once(marker.as_str())
        .expect("golden vector field exists")
        .1
        .trim_start();
    let value = value.strip_prefix('"').unwrap_or(value);
    let end = value
        .find(|character| matches!(character, '"' | ',' | '}'))
        .expect("golden vector field is terminated");
    &value[..end]
}

#[test]
fn golden_yield_vectors_match_contract() {
    let vectors = vector_objects("yield_vectors");
    assert!(!vectors.is_empty(), "yield vectors must not be empty");

    for (index, vector) in vectors.iter().enumerate() {
        let amount = field(vector, "amount").parse().expect("valid amount");
        let days = field(vector, "days").parse().expect("valid days");
        let risk = match field(vector, "risk") {
            "safe" => RiskProfile::Safe,
            "balanced" => RiskProfile::Balanced,
            "aggressive" => RiskProfile::Aggressive,
            other => panic!("unknown risk profile: {other}"),
        };
        let expected = field(vector, "expected_yield")
            .parse()
            .expect("valid expected yield");

        assert_eq!(
            EscrowContract::calculate_accrued_yield(amount, days, risk),
            expected,
            "yield vector #{index}: {vector}"
        );
    }
}

#[test]
fn golden_penalty_vectors_match() {
    let vectors = vector_objects("penalty_vectors");
    assert!(!vectors.is_empty(), "penalty vectors must not be empty");

    for (index, vector) in vectors.iter().enumerate() {
        let amount = field(vector, "amount").parse().expect("valid amount");
        let bps: u32 = field(vector, "bps").parse().expect("valid bps");
        assert!(bps <= MAX_PENALTY_BPS);
        let expected_penalty = field(vector, "expected_penalty")
            .parse()
            .expect("valid expected penalty");
        let expected_refund = field(vector, "expected_refund")
            .parse()
            .expect("valid expected refund");

        assert_eq!(
            EscrowContract::penalty_for(amount, bps),
            Ok((expected_penalty, expected_refund)),
            "penalty vector #{index}: {vector}"
        );
    }
}
