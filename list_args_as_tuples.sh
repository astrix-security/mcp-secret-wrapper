#!/bin/bash

# Script to list command line arguments as tuples
# Parses arguments in the form: --flag VALUE or -f VALUE
# Usage: ./list_args_as_tuples.sh --user STRING -u VALUE --flag VALUE

# Check if no arguments provided
if [ $# -eq 0 ]; then
    echo "No arguments provided."
    exit 0
fi

# Process arguments as flag-value pairs
i=1
while [ $i -le $# ]; do
    arg="${!i}"
    
    # Check if current argument is a flag (starts with -)
    if [[ "$arg" =~ ^- ]]; then
        # Extract label by removing leading dashes
        label="${arg#-}"  # Remove single dash
        label="${label#-}"  # Remove second dash if present (handles --)
        
        # Check if there's a value following this flag
        if [ $((i + 1)) -le $# ]; then
            j=$((i + 1))
            value="${!j}"
            # Check if the next argument is not another flag
            if [[ ! "$value" =~ ^- ]]; then
                echo "($label, $value)"
                i=$((i + 2))
            else
                # Next arg is also a flag, current flag has no value
                echo "($label, )"
                i=$((i + 1))
            fi
        else
            # Last argument is a flag with no value
            echo "($label, )"
            i=$((i + 1))
        fi
    else
        # Standalone argument (not a flag), skip it or handle as needed
        echo "Warning: Standalone argument '$arg' (not a flag) at position $i" >&2
        i=$((i + 1))
    fi
done

