//! cargo-deps: clap = { version = "4.5", features = ["derive"] }, serde = { version = "1.0", features = ["derive"] }, serde_json = "1.0", anyhow = "1.0"
//! nih.rs
//! -------------------------------------------------------------
//! A single‑file CLI for the NIH language.
//!
//! Build & run with plain Cargo *or* with `cargo‑script`:
//!   $ cargo run --quiet --release -- nih ast example.nih
//!   # or, if you have cargo‑script:
//!   $ cargo script nih.rs -- ast example.nih
//! -------------------------------------------------------------

use clap::{Parser, Subcommand};
use serde::Serialize;
use std::{fs, path::PathBuf};

/// Top‑level CLI definition.
#[derive(Parser)]
#[command(name = "nih", version, author, about = "Tiny NIH‑language helper")]
struct Cli {
    #[command(subcommand)]
    cmd: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Parse a .nih document and emit its AST as JSON.
    Ast {
        /// Path to the .nih file
        file: PathBuf,
    },
}

/// ---------------------------------------------------------------------------
/// AST types
/// ---------------------------------------------------------------------------
#[derive(Serialize)]
struct Project {
    files: Vec<File>,
}

#[derive(Serialize)]
struct File {
    name: String,
    lang: Option<String>,
    sections: Vec<Section>,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum Section {
    Markdown { text: String },
    Code { source: String },
}

/// ---------------------------------------------------------------------------
/// Very small “good‑enough” parser
/// ---------------------------------------------------------------------------
fn parse_document(src: &str) -> Project {
    let mut files: Vec<File> = Vec::new();
    let mut current_file: Option<File> = None;
    let mut mode = Mode::Markdown;
    let mut buffer = String::new();

    for line in src.lines() {
        if let Some(rest) = line.strip_prefix("#file") {
            // Flush previous file, if any.
            if let Some(mut f) = current_file.take() {
                flush_section(&mut f, &mut buffer, &mode);
                files.push(f);
            }
            // Start new file.
            let (name, lang) = parse_file_attrs(rest);
            current_file = Some(File {
                name,
                lang,
                sections: Vec::new(),
            });
            mode = Mode::Markdown;
        } else if line.trim_start().starts_with("#code") {
            if let Some(f) = current_file.as_mut() {
                flush_section(f, &mut buffer, &mode);
                mode = Mode::Code;
            }
        } else if line.trim_start().starts_with("#end code") {
            if let Some(f) = current_file.as_mut() {
                flush_section(f, &mut buffer, &mode);
                mode = Mode::Markdown;
            }
        } else if line.trim_start().starts_with("#end file") {
            if let Some(mut f) = current_file.take() {
                flush_section(&mut f, &mut buffer, &mode);
                files.push(f);
            }
            mode = Mode::Markdown;
        } else {
            buffer.push_str(line);
            buffer.push('\n');
        }
    }

    // End‑of‑file flush
    if let Some(mut f) = current_file {
        flush_section(&mut f, &mut buffer, &mode);
        files.push(f);
    }

    Project { files }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Mode {
    Markdown,
    Code,
}

fn flush_section(file: &mut File, buf: &mut String, mode: &Mode) {
    if buf.is_empty() {
        return;
    }
    match mode {
        Mode::Markdown => file.sections.push(Section::Markdown { text: buf.clone() }),
        Mode::Code => file.sections.push(Section::Code { source: buf.clone() }),
    }
    buf.clear();
}

fn parse_file_attrs(rest: &str) -> (String, Option<String>) {
    let mut name = "<unnamed>".to_string();
    let mut lang = None;

    for tok in rest.split_whitespace() {
        if let Some(v) = tok.strip_prefix("name=\"") {
            name = v.trim_end_matches('"').to_string();
        } else if let Some(v) = tok.strip_prefix("lang=\"") {
            lang = Some(v.trim_end_matches('"').to_string());
        }
    }
    (name, lang)
}

/// ---------------------------------------------------------------------------
/// Entry point
/// ---------------------------------------------------------------------------
fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.cmd {
        Command::Ast { file } => {
            let src = fs::read_to_string(&file)?;
            let ast = parse_document(&src);
            println!("{}", serde_json::to_string_pretty(&ast)?);
        }
    }

    Ok(())
}
