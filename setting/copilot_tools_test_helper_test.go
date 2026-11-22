package setting

import "github.com/QuantumNous/new-api/common"

// unmarshalToolList decodes a stored tool list with the project's JSON codec, so
// the tests exercise the same path the option map uses.
func unmarshalToolList(raw string, target *[]string) error {
	return common.Unmarshal([]byte(raw), target)
}
